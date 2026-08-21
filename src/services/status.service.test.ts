import {
  statusService,
  StatusNaoEncontradoError,
  NomeStatusDuplicadoError,
  TipoStatusInvalidoError,
  StatusComCasosError,
  PermissaoNegadaError,
} from "./status.service";
import { statusRepository } from "@/repositories/status.repository";
import { tipoStatusRepository } from "@/repositories/tipo-status.repository";
import { logService } from "@/services/log.service";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { Status, TipoStatus } from "@prisma/client";

jest.mock("@/repositories/status.repository");
jest.mock("@/repositories/tipo-status.repository");
jest.mock("@/services/log.service");
jest.mock("@/lib/prisma", () => ({
  // A transação roda o callback direto: os repositórios já estão mockados.
  prisma: { $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({})) },
}));

const repo = statusRepository as jest.Mocked<typeof statusRepository>;
const tipoRepo = tipoStatusRepository as jest.Mocked<typeof tipoStatusRepository>;
const logs = logService as jest.Mocked<typeof logService>;

function ctx(role: TenantContext["role"] = "owner"): TenantContext {
  return { usuarioId: "user-1", escritorioId: "esc-1", role };
}

function statusFake(over: Partial<Status> = {}): Status {
  return {
    id: "status-1",
    escritorioId: "esc-1",
    tipoStatusId: "tipo-1",
    nome: "Lead",
    icone: "UserPlus",
    cor: "#64748b",
    descricao: null,
    ordem: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...over,
  };
}

function tipoFake(over: Partial<TipoStatus> = {}): TipoStatus {
  return {
    id: "tipo-1",
    chave: "lead",
    nome: "Lead",
    icone: "UserPlus",
    cor: "#64748b",
    descricao: null,
    ordem: 1,
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  logs.registrar.mockResolvedValue({} as never);
});

describe("statusService.obter", () => {
  it("devolve o status do próprio escritório", async () => {
    repo.findById.mockResolvedValue(statusFake());
    await expect(statusService.obter(ctx(), "status-1")).resolves.toMatchObject({
      id: "status-1",
    });
  });

  it("trata status inexistente como não encontrado", async () => {
    repo.findById.mockResolvedValue(null);
    await expect(statusService.obter(ctx(), "status-1")).rejects.toThrow(
      StatusNaoEncontradoError
    );
  });

  // RN19: status de outro tenant não pode nem ter sua existência confirmada.
  it("trata status de outro escritório como não encontrado", async () => {
    repo.findById.mockResolvedValue(statusFake({ escritorioId: "esc-2" }));
    await expect(statusService.obter(ctx(), "status-1")).rejects.toThrow(
      StatusNaoEncontradoError
    );
  });
});

describe("statusService.criar", () => {
  const dados = {
    nome: "Novo Status",
    tipoStatusId: "tipo-1",
    icone: "MessageCircle",
    cor: "#64748b",
  };

  it("bloqueia criação por role padrao", async () => {
    await expect(statusService.criar(ctx("padrao"), dados)).rejects.toThrow(
      PermissaoNegadaError
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it.each(["owner", "admin"] as const)("permite criação por %s", async (role) => {
    tipoRepo.findById.mockResolvedValue(tipoFake());
    repo.findByNome.mockResolvedValue(null);
    repo.listar.mockResolvedValue([]);
    repo.create.mockResolvedValue(statusFake());

    await statusService.criar(ctx(role), dados);

    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it("rejeita tipoStatusId inexistente", async () => {
    tipoRepo.findById.mockResolvedValue(null);

    await expect(statusService.criar(ctx(), dados)).rejects.toThrow(TipoStatusInvalidoError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("rejeita nome duplicado no escritório", async () => {
    tipoRepo.findById.mockResolvedValue(tipoFake());
    repo.findByNome.mockResolvedValue(statusFake());

    await expect(statusService.criar(ctx(), dados)).rejects.toThrow(NomeStatusDuplicadoError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("calcula a ordem como o próximo número após o maior existente", async () => {
    tipoRepo.findById.mockResolvedValue(tipoFake());
    repo.findByNome.mockResolvedValue(null);
    repo.listar.mockResolvedValue([statusFake({ ordem: 1 }), statusFake({ ordem: 5 })]);
    repo.create.mockResolvedValue(statusFake());

    await statusService.criar(ctx(), dados);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ ordem: 6 }),
      expect.anything()
    );
  });

  it("normaliza o nome e registra log de criação", async () => {
    tipoRepo.findById.mockResolvedValue(tipoFake());
    repo.findByNome.mockResolvedValue(null);
    repo.listar.mockResolvedValue([]);
    repo.create.mockResolvedValue(statusFake());

    await statusService.criar(ctx(), { ...dados, nome: "  Novo Status  " });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: "Novo Status",
        escritorio: { connect: { id: "esc-1" } },
        tipo: { connect: { id: "tipo-1" } },
      }),
      expect.anything()
    );
    expect(logs.registrar).toHaveBeenCalledWith(
      ctx(),
      expect.objectContaining({ acao: "criar", entidade: "status", entidadeId: "status-1" }),
      expect.anything()
    );
  });
});

describe("statusService.atualizar", () => {
  it("bloqueia atualização por role padrao", async () => {
    await expect(
      statusService.atualizar(ctx("padrao"), "status-1", { nome: "X" })
    ).rejects.toThrow(PermissaoNegadaError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("não grava nem loga quando nada muda", async () => {
    repo.findById.mockResolvedValue(statusFake());

    const resultado = await statusService.atualizar(ctx(), "status-1", {
      nome: "Lead",
    });

    expect(resultado).toEqual(statusFake());
    expect(repo.update).not.toHaveBeenCalled();
    expect(logs.registrar).not.toHaveBeenCalled();
  });

  it("atualiza e registra o diff no log", async () => {
    repo.findById.mockResolvedValue(statusFake());
    repo.findByNome.mockResolvedValue(null);
    repo.update.mockResolvedValue(statusFake({ nome: "Renomeado" }));

    await statusService.atualizar(ctx(), "status-1", { nome: "Renomeado" });

    expect(repo.update).toHaveBeenCalledWith(
      "status-1",
      expect.objectContaining({ nome: "Renomeado" }),
      expect.anything()
    );
    expect(logs.registrar).toHaveBeenCalledWith(
      ctx(),
      expect.objectContaining({
        acao: "atualizar",
        entidade: "status",
        dados: expect.objectContaining({
          nome: { antes: "Lead", depois: "Renomeado" },
        }),
      }),
      expect.anything()
    );
  });

  it("rejeita renomear para um nome já usado por outro status", async () => {
    repo.findById.mockResolvedValue(statusFake());
    repo.findByNome.mockResolvedValue(statusFake({ id: "status-2" }));

    await expect(
      statusService.atualizar(ctx(), "status-1", { nome: "Em uso" })
    ).rejects.toThrow(NomeStatusDuplicadoError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("rejeita tipoStatusId inexistente", async () => {
    repo.findById.mockResolvedValue(statusFake());
    tipoRepo.findById.mockResolvedValue(null);

    await expect(
      statusService.atualizar(ctx(), "status-1", { tipoStatusId: "tipo-invalido" })
    ).rejects.toThrow(TipoStatusInvalidoError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("trata status de outro escritório como não encontrado", async () => {
    repo.findById.mockResolvedValue(statusFake({ escritorioId: "esc-2" }));

    await expect(
      statusService.atualizar(ctx(), "status-1", { nome: "X" })
    ).rejects.toThrow(StatusNaoEncontradoError);
  });
});

describe("statusService.excluir", () => {
  it("bloqueia exclusão por role padrao", async () => {
    await expect(statusService.excluir(ctx("padrao"), "status-1")).rejects.toThrow(
      PermissaoNegadaError
    );
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it("exclui e registra log quando não há casos vinculados", async () => {
    repo.findById.mockResolvedValue(statusFake());
    repo.contarCasos.mockResolvedValue(0);

    await statusService.excluir(ctx(), "status-1");

    expect(repo.delete).toHaveBeenCalledWith("status-1", expect.anything());
    expect(logs.registrar).toHaveBeenCalledWith(
      ctx(),
      expect.objectContaining({ acao: "excluir", entidade: "status", entidadeId: "status-1" }),
      expect.anything()
    );
  });

  // Checado antes da escrita, para não depender de capturar a violação de FK
  // (onDelete: Restrict) do Caso.status.
  it("bloqueia exclusão de status com casos vinculados", async () => {
    repo.findById.mockResolvedValue(statusFake());
    repo.contarCasos.mockResolvedValue(3);

    await expect(statusService.excluir(ctx(), "status-1")).rejects.toThrow(StatusComCasosError);
    expect(repo.delete).not.toHaveBeenCalled();
  });
});

describe("statusService.criarPadroes", () => {
  it("cria os 9 status padrão, um por tipo, na ordem esperada", async () => {
    tipoRepo.findByChave.mockImplementation(async (chave: string) =>
      tipoFake({ id: `tipo-${chave}`, chave })
    );
    repo.create.mockImplementation(async (data) => statusFake({ nome: (data as { nome: string }).nome }));

    const criados = await statusService.criarPadroes("esc-1");

    expect(criados).toHaveLength(9);
    expect(repo.create).toHaveBeenCalledTimes(9);
    expect(repo.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        nome: "Lead",
        ordem: 1,
        escritorio: { connect: { id: "esc-1" } },
      }),
      expect.anything()
    );
  });

  it("propaga erro se um tipo padrão não existir na base (seed ausente)", async () => {
    tipoRepo.findByChave.mockResolvedValue(null);

    await expect(statusService.criarPadroes("esc-1")).rejects.toThrow(TipoStatusInvalidoError);
  });
});
