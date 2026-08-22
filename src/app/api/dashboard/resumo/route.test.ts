/**
 * @jest-environment node
 */
import { GET } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { dashboardService } from "@/services/dashboard.service";

jest.mock("@/lib/auth/tenant-context", () => {
  class NaoAutenticadoError extends Error {}
  class SemEscritorioAtivoError extends Error {}
  class AcessoNegadoError extends Error {}
  return {
    getTenantContext: jest.fn(),
    NaoAutenticadoError,
    SemEscritorioAtivoError,
    AcessoNegadoError,
  };
});
jest.mock("@/services/dashboard.service", () => ({
  dashboardService: { resumo: jest.fn() },
}));

const mockedGetTenantContext = getTenantContext as jest.Mock;
const service = dashboardService as jest.Mocked<typeof dashboardService>;

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" as const };

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
});

function requisicao(query = ""): Request {
  return new Request(`http://localhost/api/dashboard/resumo${query}`);
}

describe("GET /api/dashboard/resumo", () => {
  it("devolve o resumo montado pelo Service", async () => {
    const resumo = {
      porTipoStatus: [{ tipoStatus: { id: "tipo-1" }, total: 2 }],
    };
    service.resumo.mockResolvedValue(resumo as never);

    const response = await GET(requisicao());
    const corpo = await response.json();

    expect(response.status).toBe(200);
    expect(corpo).toEqual(resumo);
    expect(service.resumo).toHaveBeenCalledWith(ctx, {
      clienteIds: undefined,
      responsavelIds: undefined,
      dataInicio: undefined,
      dataFim: undefined,
    });
  });

  it("repassa os filtros de cliente, responsável e período da query ao Service", async () => {
    service.resumo.mockResolvedValue({ porTipoStatus: [] } as never);

    await GET(
      requisicao(
        "?clienteId=cli-1&responsavelId=membro-1&dataInicio=2026-01-01&dataFim=2026-08-01"
      )
    );

    expect(service.resumo).toHaveBeenCalledWith(ctx, {
      clienteIds: ["cli-1"],
      responsavelIds: ["membro-1"],
      dataInicio: new Date("2026-01-01"),
      dataFim: new Date("2026-08-01"),
    });
  });

  it("responde 401 sem sessão", async () => {
    const { NaoAutenticadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    const response = await GET(requisicao());
    expect(response.status).toBe(401);
  });

  it("responde 409 sem escritório ativo na sessão", async () => {
    const { SemEscritorioAtivoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new SemEscritorioAtivoError());

    const response = await GET(requisicao());
    expect(response.status).toBe(409);
  });

  it("responde 403 sem acesso ao escritório", async () => {
    const { AcessoNegadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new AcessoNegadoError());

    const response = await GET(requisicao());
    expect(response.status).toBe(403);
  });

  it("responde 500 sem vazar detalhe interno em erro inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.resumo.mockRejectedValue(new Error("connection reset by peer"));

    const response = await GET(requisicao());
    const corpo = await response.json();

    expect(response.status).toBe(500);
    expect(corpo.error).not.toMatch(/connection reset/);
  });
});
