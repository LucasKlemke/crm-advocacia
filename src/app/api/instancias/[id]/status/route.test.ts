/**
 * @jest-environment node
 */
import { GET } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { instanciaWhatsappService } from "@/services/instancia-whatsapp.service";

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
jest.mock("@/services/instancia-whatsapp.service", () => {
  class InstanciaWhatsappNaoEncontradaError extends Error {}
  class NomeInstanciaDuplicadoError extends Error {}
  class PermissaoNegadaError extends Error {}
  return {
    instanciaWhatsappService: { verificarStatus: jest.fn() },
    InstanciaWhatsappNaoEncontradaError,
    NomeInstanciaDuplicadoError,
    PermissaoNegadaError,
  };
});
jest.mock("@/lib/external/uazapi-client", () => {
  class UazapiIndisponivelError extends Error {}
  return { uazapiClient: {}, UazapiIndisponivelError };
});

const mockedGetTenantContext = getTenantContext as jest.Mock;
const service = instanciaWhatsappService as jest.Mocked<typeof instanciaWhatsappService>;

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "owner" as const };
const params = Promise.resolve({ id: "instancia-1" });

function get() {
  return GET(new Request("http://localhost/api/instancias/instancia-1/status"), { params });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
});

describe("GET /api/instancias/[id]/status", () => {
  it("retorna 401 sem sessão", async () => {
    const { NaoAutenticadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    const response = await get();
    expect(response.status).toBe(401);
  });

  it("consulta o status da instância e responde 200", async () => {
    service.verificarStatus.mockResolvedValue({ id: "instancia-1", status: "conectado" } as never);

    const response = await get();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(service.verificarStatus).toHaveBeenCalledWith(ctx, "instancia-1");
    expect(body).toEqual({ instancia: { id: "instancia-1", status: "conectado" } });
  });

  it("responde 404 para instância de outro escritório", async () => {
    const { InstanciaWhatsappNaoEncontradaError } = jest.requireMock(
      "@/services/instancia-whatsapp.service"
    );
    service.verificarStatus.mockRejectedValue(new InstanciaWhatsappNaoEncontradaError());

    const response = await get();
    expect(response.status).toBe(404);
  });

  it("responde 502 quando a UAZAPI está indisponível", async () => {
    const { UazapiIndisponivelError } = jest.requireMock("@/lib/external/uazapi-client");
    service.verificarStatus.mockRejectedValue(new UazapiIndisponivelError());

    const response = await get();
    expect(response.status).toBe(502);
  });

  it("retorna 500 sem vazar detalhe interno em erro inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.verificarStatus.mockRejectedValue(new Error("connection reset by peer"));

    const response = await get();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).not.toMatch(/connection reset/);
  });
});
