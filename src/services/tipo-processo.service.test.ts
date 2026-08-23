import {
  tipoProcessoService,
  TipoProcessoNaoEncontradoError,
  NomeTipoProcessoDuplicadoError,
  TipoProcessoComCasosError,
  PermissaoNegadaError,
} from "./tipo-processo.service";
import { tipoProcessoRepository } from "@/repositories/tipo-processo.repository";
import { logService } from "@/services/log.service";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { TipoProcesso } from "@prisma/client";

jest.mock("@/repositories/tipo-processo.repository");
jest.mock("@/services/log.service");
jest.mock("@/lib/prisma", () => ({
  // A transação roda o callback direto: os repositórios já estão mockados.
  prisma: { $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({})) },
}));

const repo = tipoProcessoRepository as jest.Mocked<typeof tipoProcessoRepository>;
const logs = logService as jest.Mocked<typeof logService>;

function ctx(role: TenantContext["role"] = "owner"): TenantContext {
  return { usuarioId: "user-1", escritorioId: "esc-1", role };
}

function tipoFake(over: Partial<TipoProcesso> = {}): TipoProcesso {
  return {
    id: "tipo-processo-1",
    escritorioId: "esc-1",
    nome: "Juros abusivos",
    icone: "Briefcase",
    cor: "#6366f1",
    descricao: null,
    ordem: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  logs.registrar.mockResolvedValue({} as never);
});

describe("tipoProcessoService.obter", () => {
  it("devolve o tipo do próprio escritório", async () => {
    repo.findById.mockResolvedValue(tipoFake());
    await expect(tipoProcessoService.obter(ctx(), "tipo-processo-1")).resolves.toEqual(tipoFake());
  });

  it("trata tipo de outro escritório como inexistente (RN19)", async () => {
    repo.findById.mockResolvedValue(tipoFake({ escritorioId: "esc-2" }));
    await expect(tipoProcessoService.obter(ctx(), "tipo-processo-1")).rejects.toThrow(
      TipoProcessoNaoEncontradoError
    );
  });

  it("rejeita id inexistente", async () => {
    repo.findById.mockResolvedValue(null);
    await expect(tipoProcessoService.obter(ctx(), "sumido")).rejects.toThrow(
      TipoProcessoNaoEncontradoError
    );
  });
});

describe("tipoProcessoService.criar", () => {
  const dados = { nome: "  Juros abusivos  ", icone: "Briefcase", cor: "#6366f1" };

  it("cria com o nome trimado, ordem no fim da lista e registra log", async () => {
    repo.findByNome.mockResolvedValue(null);
    repo.listar.mockResolvedValue([tipoFake({ ordem: 3 }), tipoFake({ ordem: 7 })]);
    repo.create.mockResolvedValue(tipoFake());

    await tipoProcessoService.criar(ctx(), dados);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: "Juros abusivos",
        ordem: 8,
        escritorio: { connect: { id: "esc-1" } },
      }),
      expect.anything()
    );
    expect(logs.registrar).toHaveBeenCalledWith(
      ctx(),
      expect.objectContaining({ acao: "criar", entidade: "tipo_processo" }),
      expect.anything()
    );
  });

  it("rejeita nome já usado no escritório", async () => {
    repo.findByNome.mockResolvedValue(tipoFake());
    await expect(tipoProcessoService.criar(ctx(), dados)).rejects.toThrow(
      NomeTipoProcessoDuplicadoError
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("bloqueia o papel padrao (configuração é de owner/admin)", async () => {
    await expect(tipoProcessoService.criar(ctx("padrao"), dados)).rejects.toThrow(
      PermissaoNegadaError
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("permite admin", async () => {
    repo.findByNome.mockResolvedValue(null);
    repo.listar.mockResolvedValue([]);
    repo.create.mockResolvedValue(tipoFake());
    await expect(tipoProcessoService.criar(ctx("admin"), dados)).resolves.toBeDefined();
  });
});

describe("tipoProcessoService.atualizar", () => {
  it("não grava nem loga quando nada muda", async () => {
    repo.findById.mockResolvedValue(tipoFake());

    const resultado = await tipoProcessoService.atualizar(ctx(), "tipo-processo-1", {
      nome: "Juros abusivos",
    });

    expect(resultado).toEqual(tipoFake());
    expect(repo.update).not.toHaveBeenCalled();
    expect(logs.registrar).not.toHaveBeenCalled();
  });

  it("atualiza e registra o diff no log", async () => {
    repo.findById.mockResolvedValue(tipoFake());
    repo.findByNome.mockResolvedValue(null);
    repo.update.mockResolvedValue(tipoFake({ nome: "Revisional" }));

    await tipoProcessoService.atualizar(ctx(), "tipo-processo-1", { nome: "Revisional" });

    expect(repo.update).toHaveBeenCalledWith(
      "tipo-processo-1",
      expect.objectContaining({ nome: "Revisional" }),
      expect.anything()
    );
    expect(logs.registrar).toHaveBeenCalledWith(
      ctx(),
      expect.objectContaining({
        acao: "atualizar",
        entidade: "tipo_processo",
        dados: expect.objectContaining({
          nome: { antes: "Juros abusivos", depois: "Revisional" },
        }),
      }),
      expect.anything()
    );
  });

  it("rejeita renomear para um nome já usado no escritório", async () => {
    repo.findById.mockResolvedValue(tipoFake());
    repo.findByNome.mockResolvedValue(tipoFake({ id: "outro" }));

    await expect(
      tipoProcessoService.atualizar(ctx(), "tipo-processo-1", { nome: "Revisional" })
    ).rejects.toThrow(NomeTipoProcessoDuplicadoError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("bloqueia o papel padrao", async () => {
    await expect(
      tipoProcessoService.atualizar(ctx("padrao"), "tipo-processo-1", { nome: "X" })
    ).rejects.toThrow(PermissaoNegadaError);
  });
});

describe("tipoProcessoService.excluir", () => {
  it("exclui quando não há processos vinculados e registra log", async () => {
    repo.findById.mockResolvedValue(tipoFake());
    repo.contarCasos.mockResolvedValue(0);

    await tipoProcessoService.excluir(ctx(), "tipo-processo-1");

    expect(repo.delete).toHaveBeenCalledWith("tipo-processo-1", expect.anything());
    expect(logs.registrar).toHaveBeenCalledWith(
      ctx(),
      expect.objectContaining({ acao: "excluir", entidade: "tipo_processo" }),
      expect.anything()
    );
  });

  it("recusa excluir tipo com processos vinculados", async () => {
    repo.findById.mockResolvedValue(tipoFake());
    repo.contarCasos.mockResolvedValue(3);

    await expect(tipoProcessoService.excluir(ctx(), "tipo-processo-1")).rejects.toThrow(
      TipoProcessoComCasosError
    );
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it("bloqueia o papel padrao", async () => {
    await expect(tipoProcessoService.excluir(ctx("padrao"), "tipo-processo-1")).rejects.toThrow(
      PermissaoNegadaError
    );
  });
});

describe("tipoProcessoService.criarPadroes", () => {
  it("seeda os tipos iniciais em ordem, no escritório informado", async () => {
    repo.create.mockImplementation(async (data) => tipoFake({ nome: String(data.nome) }));

    await tipoProcessoService.criarPadroes("esc-novo");

    expect(repo.create).toHaveBeenCalledTimes(8);
    expect(repo.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        nome: "Ação trabalhista",
        ordem: 1,
        escritorio: { connect: { id: "esc-novo" } },
      }),
      expect.anything()
    );
    expect(repo.create).toHaveBeenNthCalledWith(
      8,
      expect.objectContaining({ nome: "Consultivo", ordem: 8 }),
      expect.anything()
    );
  });
});
