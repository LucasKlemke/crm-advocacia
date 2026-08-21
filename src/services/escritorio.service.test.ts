import {
  escritorioService,
  EscritorioNaoEncontradoError,
  PermissaoNegadaError,
} from "./escritorio.service";
import { escritorioRepository } from "@/repositories/escritorio.repository";
import { membroRepository } from "@/repositories/membro.repository";
import { statusService } from "@/services/status.service";
import { prisma } from "@/lib/prisma";
import type { TenantContext } from "@/lib/auth/tenant-context";

jest.mock("@/repositories/escritorio.repository");
jest.mock("@/repositories/membro.repository");
jest.mock("@/services/status.service");
jest.mock("@/lib/prisma", () => ({
  prisma: { $transaction: jest.fn() },
}));

const mockedEscritorioRepo = escritorioRepository as jest.Mocked<typeof escritorioRepository>;
const mockedMembroRepo = membroRepository as jest.Mocked<typeof membroRepository>;
const mockedStatusService = statusService as jest.Mocked<typeof statusService>;
const mockedPrisma = prisma as unknown as { $transaction: jest.Mock };

function ctx(role: TenantContext["role"]): TenantContext {
  return { usuarioId: "user-1", escritorioId: "esc-1", role };
}

describe("escritorioService.criarEscritorio", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({})
    );
  });

  it("cria escritório e membro owner na mesma transação (RN02)", async () => {
    mockedEscritorioRepo.create.mockResolvedValue({ id: "esc-1", nome: "Escritório Teste" } as never);
    mockedMembroRepo.create.mockResolvedValue({ id: "membro-1", role: "owner" } as never);
    mockedStatusService.criarPadroes.mockResolvedValue([]);

    const resultado = await escritorioService.criarEscritorio("user-1", {
      nome: "Escritório Teste",
    });

    expect(mockedEscritorioRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ nome: "Escritório Teste" }),
      expect.anything()
    );
    expect(mockedMembroRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        usuario: { connect: { id: "user-1" } },
        escritorio: { connect: { id: "esc-1" } },
        role: "owner",
      }),
      expect.anything()
    );
    expect(resultado.membro.role).toBe("owner");
  });

  // Kanban não pode nascer vazio: o funil padrão é seedado na mesma transação do
  // escritório, com o client da transação (tx), não o prisma global.
  it("seeda os status padrão do escritório na mesma transação", async () => {
    mockedEscritorioRepo.create.mockResolvedValue({ id: "esc-1", nome: "Escritório Teste" } as never);
    mockedMembroRepo.create.mockResolvedValue({ id: "membro-1", role: "owner" } as never);
    mockedStatusService.criarPadroes.mockResolvedValue([]);

    await escritorioService.criarEscritorio("user-1", { nome: "Escritório Teste" });

    expect(mockedStatusService.criarPadroes).toHaveBeenCalledWith("esc-1", expect.anything());
  });
});

describe("escritorioService.obterEscritorioAtivo", () => {
  afterEach(() => jest.clearAllMocks());

  it("retorna o escritório do contexto", async () => {
    mockedEscritorioRepo.findById.mockResolvedValue({ id: "esc-1" } as never);

    const resultado = await escritorioService.obterEscritorioAtivo(ctx("padrao"));

    expect(resultado).toEqual({ id: "esc-1" });
  });

  it("lança EscritorioNaoEncontradoError quando o escritório não existe mais", async () => {
    mockedEscritorioRepo.findById.mockResolvedValue(null);

    await expect(escritorioService.obterEscritorioAtivo(ctx("owner"))).rejects.toThrow(
      EscritorioNaoEncontradoError
    );
  });
});

describe("escritorioService.atualizarEscritorio", () => {
  afterEach(() => jest.clearAllMocks());

  it.each(["owner", "admin"] as const)("permite edição por %s", async (role) => {
    mockedEscritorioRepo.update.mockResolvedValue({ id: "esc-1", nome: "Novo Nome" } as never);

    const resultado = await escritorioService.atualizarEscritorio(ctx(role), {
      nome: "Novo Nome",
    });

    expect(resultado.nome).toBe("Novo Nome");
  });

  it("bloqueia edição por padrao", async () => {
    await expect(
      escritorioService.atualizarEscritorio(ctx("padrao"), { nome: "Novo Nome" })
    ).rejects.toThrow(PermissaoNegadaError);
    expect(mockedEscritorioRepo.update).not.toHaveBeenCalled();
  });
});
