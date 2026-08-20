/**
 * @jest-environment node
 */
import { GET } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { casoService } from "@/services/caso.service";

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
jest.mock("@/services/caso.service", () => ({
  casoService: { listarKanban: jest.fn() },
}));

const mockedGetTenantContext = getTenantContext as jest.Mock;
const service = casoService as jest.Mocked<typeof casoService>;

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" as const };

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
});

describe("GET /api/casos/kanban", () => {
  it("devolve as colunas montadas pelo Service", async () => {
    const colunas = [{ status: { id: "status-1" }, total: 2, casos: [] }];
    service.listarKanban.mockResolvedValue(colunas as never);

    const response = await GET(new Request("http://localhost/api/casos/kanban?busca=cobrança"));
    const corpo = await response.json();

    expect(response.status).toBe(200);
    expect(corpo).toEqual({ colunas });
    expect(service.listarKanban).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ busca: "cobrança" })
    );
  });

  it("repassa statusId da query — o kanban oculta colunas não selecionadas", async () => {
    service.listarKanban.mockResolvedValue([]);

    await GET(new Request("http://localhost/api/casos/kanban?statusId=algum-id"));

    const filtrosRecebidos = service.listarKanban.mock.calls[0][1];
    expect(filtrosRecebidos).toEqual(expect.objectContaining({ statusIds: ["algum-id"] }));
  });

  it("responde 401 sem sessão", async () => {
    const { NaoAutenticadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    const response = await GET(new Request("http://localhost/api/casos/kanban"));
    expect(response.status).toBe(401);
  });

  it("responde 500 sem vazar detalhe interno em erro inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.listarKanban.mockRejectedValue(new Error("connection reset by peer"));

    const response = await GET(new Request("http://localhost/api/casos/kanban"));
    const corpo = await response.json();

    expect(response.status).toBe(500);
    expect(corpo.error).not.toMatch(/connection reset/);
  });
});
