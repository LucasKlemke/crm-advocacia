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
    instanciaWhatsappService: { reconectar: jest.fn() },
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

function post() {
  return POST(
    new Request("http://localhost/api/instancias/instancia-1/reconectar", { method: "POST" }),
    { params }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
});

describe("POST /api/instancias/[id]/reconectar", () => {
  it("retorna 401 sem sessão", async () => {
    const { NaoAutenticadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    const response = await post();
    expect(response.status).toBe(401);
  });

  it("reconecta a instância e responde 200", async () => {
    service.reconectar.mockResolvedValue({
      instancia: { id: "instancia-1" },
      qrcode: "qr-base64",
      paircode: "1234",
    } as never);

    const response = await post();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(service.reconectar).toHaveBeenCalledWith(ctx, "instancia-1");
    expect(body).toEqual({
      instancia: { id: "instancia-1" },
      qrcode: "qr-base64",
      paircode: "1234",
    });
  });

  it("responde 404 para instância de outro escritório", async () => {
    const { InstanciaWhatsappNaoEncontradaError } = jest.requireMock(
      "@/services/instancia-whatsapp.service"
    );
    service.reconectar.mockRejectedValue(new InstanciaWhatsappNaoEncontradaError());

    const response = await post();
    expect(response.status).toBe(404);
  });

  it("responde 403 quando o role não tem permissão de gestão", async () => {
    const { PermissaoNegadaError } = jest.requireMock("@/services/instancia-whatsapp.service");
    service.reconectar.mockRejectedValue(new PermissaoNegadaError());

    const response = await post();
    expect(response.status).toBe(403);
  });

  it("responde 502 quando a UAZAPI está indisponível", async () => {
    const { UazapiIndisponivelError } = jest.requireMock("@/lib/external/uazapi-client");
    service.reconectar.mockRejectedValue(new UazapiIndisponivelError());

    const response = await post();
    expect(response.status).toBe(502);
  });

  it("retorna 500 sem vazar detalhe interno em erro inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.reconectar.mockRejectedValue(new Error("connection reset by peer"));

    const response = await post();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).not.toMatch(/connection reset/);
  });
});
