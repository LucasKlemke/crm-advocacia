import { dashboardService } from "./dashboard.service";
import { casoRepository } from "@/repositories/caso.repository";
import { statusRepository } from "@/repositories/status.repository";
import { tipoStatusRepository } from "@/repositories/tipo-status.repository";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { Status, TipoStatus } from "@prisma/client";

jest.mock("@/repositories/caso.repository");
jest.mock("@/repositories/status.repository");
jest.mock("@/repositories/tipo-status.repository");

const repo = casoRepository as jest.Mocked<typeof casoRepository>;
const statusRepo = statusRepository as jest.Mocked<typeof statusRepository>;
const tipoStatusRepo = tipoStatusRepository as jest.Mocked<typeof tipoStatusRepository>;

function ctx(): TenantContext {
  return { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" };
}

const AGORA = new Date("2026-08-01T12:00:00.000Z");

function tipoStatusFake(over: Partial<TipoStatus> = {}): TipoStatus {
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

const NOVE_TIPOS: TipoStatus[] = [
  tipoStatusFake({ id: "tipo-1", chave: "lead", nome: "Lead", ordem: 1 }),
  tipoStatusFake({ id: "tipo-2", chave: "negociacao", nome: "Negociação", ordem: 2 }),
  tipoStatusFake({ id: "tipo-3", chave: "fechado", nome: "Fechado", ordem: 3 }),
  tipoStatusFake({ id: "tipo-4", chave: "preparacao", nome: "Preparação", ordem: 4 }),
  tipoStatusFake({ id: "tipo-5", chave: "tramitacao", nome: "Tramitação", ordem: 5 }),
  tipoStatusFake({ id: "tipo-6", chave: "ganho", nome: "Ganho", ordem: 6 }),
  tipoStatusFake({ id: "tipo-7", chave: "perdido", nome: "Perdido", ordem: 7 }),
  tipoStatusFake({ id: "tipo-8", chave: "concluido", nome: "Concluído", ordem: 8 }),
  tipoStatusFake({ id: "tipo-9", chave: "cancelado", nome: "Cancelado", ordem: 9 }),
];

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
    createdAt: AGORA,
    updatedAt: AGORA,
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  tipoStatusRepo.listar.mockResolvedValue(NOVE_TIPOS);
});

describe("dashboardService.contarPorTipoStatus", () => {
  it("devolve as 9 categorias mesmo quando o tenant não tem nenhum Status", async () => {
    statusRepo.listar.mockResolvedValue([]);
    repo.contarPorStatus.mockResolvedValue([]);

    const resultado = await dashboardService.contarPorTipoStatus(ctx());

    expect(resultado).toHaveLength(9);
    expect(resultado.map((r) => r.tipoStatus.chave)).toEqual([
      "lead",
      "negociacao",
      "fechado",
      "preparacao",
      "tramitacao",
      "ganho",
      "perdido",
      "concluido",
      "cancelado",
    ]);
    expect(resultado.every((r) => r.total === 0)).toBe(true);
    expect(resultado.every((r) => r.valorTotal === 0)).toBe(true);
  });

  it("devolve 0 para uma categoria cujo Status não tem casos", async () => {
    statusRepo.listar.mockResolvedValue([statusFake({ id: "status-1", tipoStatusId: "tipo-1" })]);
    repo.contarPorStatus.mockResolvedValue([]);

    const resultado = await dashboardService.contarPorTipoStatus(ctx());

    const tipo1 = resultado.find((r) => r.tipoStatus.id === "tipo-1");
    expect(tipo1?.total).toBe(0);
    expect(tipo1?.valorTotal).toBe(0);
  });

  it("soma as contagens de múltiplos Status mapeados para o mesmo TipoStatus", async () => {
    statusRepo.listar.mockResolvedValue([
      statusFake({ id: "status-1", tipoStatusId: "tipo-1" }),
      statusFake({ id: "status-2", tipoStatusId: "tipo-1" }),
      statusFake({ id: "status-3", tipoStatusId: "tipo-2" }),
    ]);
    repo.contarPorStatus.mockResolvedValue([
      { statusId: "status-1", total: 3, valorTotal: 300 },
      { statusId: "status-2", total: 2, valorTotal: 200 },
      { statusId: "status-3", total: 5, valorTotal: 500 },
    ]);

    const resultado = await dashboardService.contarPorTipoStatus(ctx());

    expect(resultado.find((r) => r.tipoStatus.id === "tipo-1")?.total).toBe(5);
    expect(resultado.find((r) => r.tipoStatus.id === "tipo-1")?.valorTotal).toBe(500);
    expect(resultado.find((r) => r.tipoStatus.id === "tipo-2")?.total).toBe(5);
    expect(resultado.find((r) => r.tipoStatus.id === "tipo-2")?.valorTotal).toBe(500);
    expect(resultado.find((r) => r.tipoStatus.id === "tipo-3")?.total).toBe(0);
    expect(resultado.find((r) => r.tipoStatus.id === "tipo-3")?.valorTotal).toBe(0);
  });

  it("chama os repositórios escopados ao escritório da sessão", async () => {
    statusRepo.listar.mockResolvedValue([]);
    repo.contarPorStatus.mockResolvedValue([]);

    await dashboardService.contarPorTipoStatus(ctx());

    expect(statusRepo.listar).toHaveBeenCalledWith("esc-1");
    expect(repo.contarPorStatus).toHaveBeenCalledWith("esc-1", {});
  });
});

describe("dashboardService.resumo", () => {
  it("monta o resumo a partir da contagem por tipo de status", async () => {
    statusRepo.listar.mockResolvedValue([]);
    repo.contarPorStatus.mockResolvedValue([]);

    const resultado = await dashboardService.resumo(ctx());

    expect(resultado.porTipoStatus).toHaveLength(9);
  });
});
