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
    chave: "nova_conversa",
    nome: "Nova conversa",
    icone: "MessageCircle",
    cor: "#64748b",
    descricao: null,
    ordem: 1,
    ...over,
  };
}

const SEIS_TIPOS: TipoStatus[] = [
  tipoStatusFake({ id: "tipo-1", chave: "nova_conversa", nome: "Nova conversa", ordem: 1 }),
  tipoStatusFake({ id: "tipo-2", chave: "analise", nome: "Em análise", ordem: 2 }),
  tipoStatusFake({ id: "tipo-3", chave: "qualificado", nome: "Qualificado", ordem: 3 }),
  tipoStatusFake({ id: "tipo-4", chave: "proposta", nome: "Proposta enviada", ordem: 4 }),
  tipoStatusFake({ id: "tipo-5", chave: "sucesso", nome: "Contrato fechado", ordem: 5 }),
  tipoStatusFake({ id: "tipo-6", chave: "perda", nome: "Não interessado", ordem: 6 }),
];

function statusFake(over: Partial<Status> = {}): Status {
  return {
    id: "status-1",
    escritorioId: "esc-1",
    tipoStatusId: "tipo-1",
    nome: "Nova conversa",
    icone: "MessageCircle",
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
  tipoStatusRepo.listar.mockResolvedValue(SEIS_TIPOS);
});

describe("dashboardService.contarPorTipoStatus", () => {
  it("devolve as 6 categorias mesmo quando o tenant não tem nenhum Status", async () => {
    statusRepo.listar.mockResolvedValue([]);
    repo.contarPorStatus.mockResolvedValue([]);

    const resultado = await dashboardService.contarPorTipoStatus(ctx());

    expect(resultado).toHaveLength(6);
    expect(resultado.map((r) => r.tipoStatus.chave)).toEqual([
      "nova_conversa",
      "analise",
      "qualificado",
      "proposta",
      "sucesso",
      "perda",
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

describe("dashboardService.casosPorMes", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-15T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("devolve exatamente 6 meses em ordem cronológica, zero-filled", async () => {
    repo.listarDatasCriacao.mockResolvedValue([]);

    const resultado = await dashboardService.casosPorMes(ctx());

    expect(resultado).toEqual([
      { mes: "2026-03", total: 0 },
      { mes: "2026-04", total: 0 },
      { mes: "2026-05", total: 0 },
      { mes: "2026-06", total: 0 },
      { mes: "2026-07", total: 0 },
      { mes: "2026-08", total: 0 },
    ]);
  });

  it("agrupa as datas de criação por mês", async () => {
    repo.listarDatasCriacao.mockResolvedValue([
      new Date("2026-06-01T10:00:00.000Z"),
      new Date("2026-06-20T10:00:00.000Z"),
      new Date("2026-08-01T10:00:00.000Z"),
      new Date("2026-08-31T23:00:00.000Z"),
      new Date("2026-08-31T23:00:00.000Z"),
    ]);

    const resultado = await dashboardService.casosPorMes(ctx());

    expect(resultado).toEqual([
      { mes: "2026-03", total: 0 },
      { mes: "2026-04", total: 0 },
      { mes: "2026-05", total: 0 },
      { mes: "2026-06", total: 2 },
      { mes: "2026-07", total: 0 },
      { mes: "2026-08", total: 3 },
    ]);
  });

  it("chama o repositório escopado ao escritório e desde 6 meses atrás", async () => {
    repo.listarDatasCriacao.mockResolvedValue([]);

    await dashboardService.casosPorMes(ctx());

    expect(repo.listarDatasCriacao).toHaveBeenCalledWith("esc-1", {
      dataInicio: expect.any(Date),
    });
  });

  it("usa o dataInicio do filtro quando ele encurta a janela de 6 meses", async () => {
    repo.listarDatasCriacao.mockResolvedValue([]);
    const dataInicioFiltro = new Date("2026-07-15T00:00:00.000Z");

    await dashboardService.casosPorMes(ctx(), { dataInicio: dataInicioFiltro });

    expect(repo.listarDatasCriacao).toHaveBeenCalledWith("esc-1", {
      dataInicio: dataInicioFiltro,
    });
  });

  it("ignora um dataInicio do filtro anterior aos 6 meses (a janela nunca alarga)", async () => {
    repo.listarDatasCriacao.mockResolvedValue([]);
    const dataInicioFiltro = new Date("2020-01-01T00:00:00.000Z");

    await dashboardService.casosPorMes(ctx(), { dataInicio: dataInicioFiltro });

    const [, filtrosChamados] = repo.listarDatasCriacao.mock.calls[0];
    expect((filtrosChamados as { dataInicio: Date }).dataInicio.getTime()).toBeGreaterThan(
      dataInicioFiltro.getTime()
    );
  });

  it("repassa clienteIds e responsavelIds do filtro ao repositório", async () => {
    repo.listarDatasCriacao.mockResolvedValue([]);

    await dashboardService.casosPorMes(ctx(), {
      clienteIds: ["cli-1"],
      responsavelIds: ["membro-1"],
    });

    expect(repo.listarDatasCriacao).toHaveBeenCalledWith("esc-1", {
      clienteIds: ["cli-1"],
      responsavelIds: ["membro-1"],
      dataInicio: expect.any(Date),
    });
  });
});

describe("dashboardService.valorTotalAberto", () => {
  it("delega ao repositório escopado ao escritório", async () => {
    repo.somarValorAberto.mockResolvedValue(1234.5);

    const resultado = await dashboardService.valorTotalAberto(ctx());

    expect(resultado).toBe(1234.5);
    expect(repo.somarValorAberto).toHaveBeenCalledWith("esc-1", {});
  });

  it("repassa os filtros ao repositório", async () => {
    repo.somarValorAberto.mockResolvedValue(0);

    await dashboardService.valorTotalAberto(ctx(), { clienteIds: ["cli-1"] });

    expect(repo.somarValorAberto).toHaveBeenCalledWith("esc-1", { clienteIds: ["cli-1"] });
  });
});

describe("dashboardService.resumo", () => {
  it("monta os três campos do resumo", async () => {
    statusRepo.listar.mockResolvedValue([]);
    repo.contarPorStatus.mockResolvedValue([]);
    repo.listarDatasCriacao.mockResolvedValue([]);
    repo.somarValorAberto.mockResolvedValue(500);

    const resultado = await dashboardService.resumo(ctx());

    expect(resultado.porTipoStatus).toHaveLength(6);
    expect(resultado.porMes).toHaveLength(6);
    expect(resultado.valorTotalAberto).toBe(500);
  });
});
