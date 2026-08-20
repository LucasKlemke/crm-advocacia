/**
 * @jest-environment node
 */
import { GET } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tipoStatusService } from "@/services/tipo-status.service";

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
jest.mock("@/services/tipo-status.service", () => ({
  tipoStatusService: { listar: jest.fn() },
}));

const mockedGetTenantContext = getTenantContext as jest.Mock;
const service = tipoStatusService as jest.Mocked<typeof tipoStatusService>;

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" as const };

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
});

describe("GET /api/tipos-status", () => {
  it("retorna 401 sem sessão", async () => {
    const { NaoAutenticadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("lista os tipos de status, sem restrição de role", async () => {
    service.listar.mockResolvedValue([{ id: "tipo-1" }] as never);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(service.listar).toHaveBeenCalledWith(ctx);
    expect((await response.json()).tipos).toEqual([{ id: "tipo-1" }]);
  });

  it("retorna 500 sem vazar detalhe interno em erro inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.listar.mockRejectedValue(new Error("connection reset by peer"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).not.toMatch(/connection reset/);
  });
});
