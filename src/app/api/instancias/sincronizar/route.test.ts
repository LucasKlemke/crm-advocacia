/**
 * @jest-environment node
 */
import { POST } from "./route";
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
    instanciaWhatsappService: { sincronizarTodas: jest.fn() },
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

function post() {
  return POST();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
});

describe("POST /api/instancias/sincronizar", () => {
  it("retorna 401 sem sessão", async () => {
    const { NaoAutenticadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    const response = await post();
    expect(response.status).toBe(401);
  });

  it("sincroniza as instâncias do escritório e responde 200", async () => {
    service.sincronizarTodas.mockResolvedValue([
      { id: "instancia-1", status: "connected" },
    ] as never);

    const response = await post();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(service.sincronizarTodas).toHaveBeenCalledWith(ctx);
    expect(body).toEqual({ instancias: [{ id: "instancia-1", status: "connected" }] });
  });

  it("responde 502 quando a UAZAPI está indisponível", async () => {
    const { UazapiIndisponivelError } = jest.requireMock("@/lib/external/uazapi-client");
    service.sincronizarTodas.mockRejectedValue(new UazapiIndisponivelError());

    const response = await post();
    expect(response.status).toBe(502);
  });

  it("retorna 500 sem vazar detalhe interno em erro inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.sincronizarTodas.mockRejectedValue(new Error("connection reset by peer"));

    const response = await post();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).not.toMatch(/connection reset/);
  });
});
