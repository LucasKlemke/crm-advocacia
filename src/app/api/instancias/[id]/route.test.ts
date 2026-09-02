/**
 * @jest-environment node
 */
import { DELETE } from "./route";
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
    instanciaWhatsappService: { excluir: jest.fn() },
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

function del() {
  return DELETE(
    new Request("http://localhost/api/instancias/instancia-1", { method: "DELETE" }),
    { params }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
});

describe("DELETE /api/instancias/[id]", () => {
  it("retorna 401 sem sessão", async () => {
    const { NaoAutenticadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    const response = await del();
    expect(response.status).toBe(401);
  });

  it("exclui a instância e responde 200", async () => {
    service.excluir.mockResolvedValue(undefined);

    const response = await del();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(service.excluir).toHaveBeenCalledWith(ctx, "instancia-1");
    expect(body).toEqual({ ok: true });
  });

  it("responde 404 para instância de outro escritório", async () => {
    const { InstanciaWhatsappNaoEncontradaError } = jest.requireMock(
      "@/services/instancia-whatsapp.service"
    );
    service.excluir.mockRejectedValue(new InstanciaWhatsappNaoEncontradaError());

    const response = await del();
    expect(response.status).toBe(404);
  });

  it("responde 403 quando o role não tem permissão de gestão", async () => {
    const { PermissaoNegadaError } = jest.requireMock("@/services/instancia-whatsapp.service");
    service.excluir.mockRejectedValue(new PermissaoNegadaError());

    const response = await del();
    expect(response.status).toBe(403);
  });

  it("responde 502 quando a UAZAPI está indisponível", async () => {
    const { UazapiIndisponivelError } = jest.requireMock("@/lib/external/uazapi-client");
    service.excluir.mockRejectedValue(new UazapiIndisponivelError());

    const response = await del();
    expect(response.status).toBe(502);
  });

  it("retorna 500 sem vazar detalhe interno em erro inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.excluir.mockRejectedValue(new Error("connection reset by peer"));

    const response = await del();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).not.toMatch(/connection reset/);
  });
});
