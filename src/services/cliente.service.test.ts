import {
  clienteService,
  ClienteNaoEncontradoError,
  CpfDuplicadoError,
  CpfInvalidoError,
} from "./cliente.service";
import { clienteRepository } from "@/repositories/cliente.repository";
import { logService } from "@/services/log.service";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { Cliente } from "@prisma/client";

jest.mock("@/repositories/cliente.repository");
jest.mock("@/services/log.service");
jest.mock("@/lib/prisma", () => ({
  // A transação roda o callback direto: os repositórios já estão mockados.
  prisma: { $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({})) },
}));

const repo = clienteRepository as jest.Mocked<typeof clienteRepository>;
const logs = logService as jest.Mocked<typeof logService>;

const ctx: TenantContext = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" };

const CPF_VALIDO = "52998224725";
const OUTRO_CPF_VALIDO = "16899535009";

function clienteFake(over: Partial<Cliente> = {}): Cliente {
  return {
    id: "cli-1",
    escritorioId: "esc-1",
    nome: "Maria Silva",
    cpf: CPF_VALIDO,
    email: null,
    telefone: "48999990000",
    endereco: null,
    softDeletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  logs.registrar.mockResolvedValue({} as never);
});

describe("clienteService.obter", () => {
  it("devolve o cliente do próprio escritório", async () => {
    repo.findById.mockResolvedValue(clienteFake());
    await expect(clienteService.obter(ctx, "cli-1")).resolves.toMatchObject({ id: "cli-1" });
  });

  it("trata cliente inexistente como não encontrado", async () => {
    repo.findById.mockResolvedValue(null);
    await expect(clienteService.obter(ctx, "cli-1")).rejects.toThrow(ClienteNaoEncontradoError);
  });

  // RN19: cliente de outro tenant não pode nem ter sua existência confirmada.
  it("trata cliente de outro escritório como não encontrado", async () => {
    repo.findById.mockResolvedValue(clienteFake({ escritorioId: "esc-2" }));
    await expect(clienteService.obter(ctx, "cli-1")).rejects.toThrow(ClienteNaoEncontradoError);
  });
});

describe("clienteService.criar", () => {
  it("normaliza o CPF, cria o cliente e registra um log de criação", async () => {
    repo.findByCpf.mockResolvedValue(null);
    repo.create.mockResolvedValue(clienteFake());

    await clienteService.criar(ctx, { nome: "  Maria Silva  ", cpf: "529.982.247-25" });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: "Maria Silva",
        cpf: CPF_VALIDO,
        escritorio: { connect: { id: "esc-1" } },
      }),
      expect.anything()
    );
    expect(logs.registrar).toHaveBeenCalledTimes(1);
    expect(logs.registrar).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ acao: "criar", entidade: "cliente", entidadeId: "cli-1" }),
      expect.anything()
    );
  });

  it("converte campos opcionais vazios em null", async () => {
    repo.findByCpf.mockResolvedValue(null);
    repo.create.mockResolvedValue(clienteFake());

    await clienteService.criar(ctx, { nome: "Maria", cpf: CPF_VALIDO, email: "  ", telefone: "" });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: null, telefone: null }),
      expect.anything()
    );
  });

  it("rejeita CPF inválido antes de tocar no banco", async () => {
    await expect(clienteService.criar(ctx, { nome: "Maria", cpf: "111.111.111-11" })).rejects.toThrow(
      CpfInvalidoError
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("rejeita CPF já usado no escritório (RN05)", async () => {
    repo.findByCpf.mockResolvedValue(clienteFake());
    await expect(clienteService.criar(ctx, { nome: "Outra", cpf: CPF_VALIDO })).rejects.toThrow(
      CpfDuplicadoError
    );
  });

  it("avisa que o CPF pertence a um cliente excluído", async () => {
    repo.findByCpf.mockResolvedValue(clienteFake({ softDeletedAt: new Date() }));
    await expect(clienteService.criar(ctx, { nome: "Outra", cpf: CPF_VALIDO })).rejects.toThrow(
      /excluído/i
    );
  });
});

describe("clienteService.atualizar", () => {
  it("grava só os campos alterados e loga o diff", async () => {
    repo.findById.mockResolvedValue(clienteFake());
    repo.update.mockResolvedValue(clienteFake({ telefone: "48988887777" }));

    await clienteService.atualizar(ctx, "cli-1", {
      nome: "Maria Silva",
      telefone: "48988887777",
    });

    expect(logs.registrar).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        acao: "atualizar",
        dados: { telefone: { antes: "48999990000", depois: "48988887777" } },
      }),
      expect.anything()
    );
  });

  it("não escreve nem loga quando nada mudou", async () => {
    repo.findById.mockResolvedValue(clienteFake());

    const resultado = await clienteService.atualizar(ctx, "cli-1", { nome: "Maria Silva" });

    expect(repo.update).not.toHaveBeenCalled();
    expect(logs.registrar).not.toHaveBeenCalled();
    expect(resultado.id).toBe("cli-1");
  });

  it("recusa atualizar cliente de outro escritório", async () => {
    repo.findById.mockResolvedValue(clienteFake({ escritorioId: "esc-2" }));
    await expect(clienteService.atualizar(ctx, "cli-1", { nome: "X" })).rejects.toThrow(
      ClienteNaoEncontradoError
    );
  });

  it("recusa novo CPF já usado por outro cliente", async () => {
    repo.findById.mockResolvedValue(clienteFake());
    repo.findByCpf.mockResolvedValue(clienteFake({ id: "cli-2", cpf: OUTRO_CPF_VALIDO }));

    await expect(clienteService.atualizar(ctx, "cli-1", { cpf: OUTRO_CPF_VALIDO })).rejects.toThrow(
      CpfDuplicadoError
    );
  });

  // Reenviar o mesmo CPF no PATCH não pode colidir com o próprio registro.
  it("aceita reenviar o CPF atual sem checar duplicidade", async () => {
    repo.findById.mockResolvedValue(clienteFake());
    repo.update.mockResolvedValue(clienteFake({ nome: "Maria S. Souza" }));

    await clienteService.atualizar(ctx, "cli-1", { cpf: "529.982.247-25", nome: "Maria S. Souza" });

    expect(repo.findByCpf).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalled();
  });

  it("normaliza e-mail e endereço, tratando string vazia como null", async () => {
    repo.findById.mockResolvedValue(clienteFake({ email: "maria@ex.com", endereco: "Rua A, 10" }));
    repo.update.mockResolvedValue(clienteFake());

    await clienteService.atualizar(ctx, "cli-1", { email: "  ", endereco: "  Rua B, 20  " });

    expect(repo.update).toHaveBeenCalledWith(
      "cli-1",
      { email: null, endereco: "Rua B, 20" },
      expect.anything()
    );
  });

  it("rejeita CPF inválido na edição", async () => {
    repo.findById.mockResolvedValue(clienteFake());
    await expect(clienteService.atualizar(ctx, "cli-1", { cpf: "123" })).rejects.toThrow(
      CpfInvalidoError
    );
  });
});

describe("clienteService.desativarEmLote", () => {
  it("desativa os clientes do tenant e gera um log por cliente", async () => {
    repo.listarPorIds.mockResolvedValue([
      clienteFake({ id: "cli-1", nome: "Maria" }),
      clienteFake({ id: "cli-2", nome: "João", cpf: OUTRO_CPF_VALIDO }),
    ]);
    repo.marcarExcluidos.mockResolvedValue(2);

    const resultado = await clienteService.desativarEmLote(ctx, ["cli-1", "cli-2"]);

    expect(resultado).toEqual({ desativados: 2, ignorados: 0 });
    expect(repo.marcarExcluidos).toHaveBeenCalledWith(
      ["cli-1", "cli-2"],
      expect.any(Date),
      expect.anything()
    );
    expect(logs.registrar).toHaveBeenCalledTimes(2);
  });

  // Ids forjados no client não podem alcançar outro tenant (RN19).
  it("ignora ids que não pertencem ao escritório", async () => {
    repo.listarPorIds.mockResolvedValue([clienteFake({ id: "cli-1" })]);
    repo.marcarExcluidos.mockResolvedValue(1);

    const resultado = await clienteService.desativarEmLote(ctx, ["cli-1", "cli-de-outro-tenant"]);

    expect(resultado).toEqual({ desativados: 1, ignorados: 1 });
    expect(repo.marcarExcluidos).toHaveBeenCalledWith(["cli-1"], expect.any(Date), expect.anything());
  });

  it("ignora clientes já desativados sem gerar log duplicado", async () => {
    repo.listarPorIds.mockResolvedValue([clienteFake({ softDeletedAt: new Date() })]);

    const resultado = await clienteService.desativarEmLote(ctx, ["cli-1"]);

    expect(resultado).toEqual({ desativados: 0, ignorados: 1 });
    expect(repo.marcarExcluidos).not.toHaveBeenCalled();
    expect(logs.registrar).not.toHaveBeenCalled();
  });
});

describe("clienteService.restaurarEmLote", () => {
  it("não toca no banco quando nenhum id selecionado está excluído", async () => {
    repo.listarPorIds.mockResolvedValue([clienteFake({ softDeletedAt: null })]);

    const resultado = await clienteService.restaurarEmLote(ctx, ["cli-1"]);

    expect(resultado).toEqual({ restaurados: 0, ignorados: 1 });
    expect(repo.restaurar).not.toHaveBeenCalled();
    expect(logs.registrar).not.toHaveBeenCalled();
  });

  it("restaura só os que estavam excluídos e loga cada um", async () => {
    repo.listarPorIds.mockResolvedValue([
      clienteFake({ id: "cli-1", softDeletedAt: new Date() }),
      clienteFake({ id: "cli-2", softDeletedAt: null }),
    ]);
    repo.restaurar.mockResolvedValue(1);

    const resultado = await clienteService.restaurarEmLote(ctx, ["cli-1", "cli-2"]);

    expect(resultado).toEqual({ restaurados: 1, ignorados: 1 });
    expect(repo.restaurar).toHaveBeenCalledWith(["cli-1"], expect.anything());
    expect(logs.registrar).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ acao: "restaurar" }),
      expect.anything()
    );
  });
});

describe("clienteService.listar", () => {
  it("usa filtros vazios quando nenhum é informado", async () => {
    repo.listar.mockResolvedValue([]);
    repo.contar.mockResolvedValue(0);

    await clienteService.listar(ctx);

    expect(repo.listar).toHaveBeenCalledWith("esc-1", {});
  });

  it("escopa listagem e contagem ao escritório da sessão", async () => {
    repo.listar.mockResolvedValue([clienteFake()]);
    repo.contar.mockResolvedValue(1);

    const resultado = await clienteService.listar(ctx, { busca: "maria" });

    expect(repo.listar).toHaveBeenCalledWith("esc-1", { busca: "maria" });
    expect(repo.contar).toHaveBeenCalledWith("esc-1", { busca: "maria" });
    expect(resultado.total).toBe(1);
  });
});
