/**
 * @jest-environment node
 */
import { GET, POST } from "./route";
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
    instanciaWhatsappService: { listar: jest.fn(), criarEConectar: jest.fn() },
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

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/instancias", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
});

describe("GET /api/instancias", () => {
  it("retorna 401 sem sessão", async () => {
    const { NaoAutenticadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("lista as instâncias do escritório", async () => {
    service.listar.mockResolvedValue([{ id: "instancia-1" }] as never);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(service.listar).toHaveBeenCalledWith(ctx);
    expect((await response.json()).instancias).toEqual([{ id: "instancia-1" }]);
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

describe("POST /api/instancias", () => {
  const payloadValido = { nome: "Instância Principal" };

  it("cria e conecta a instância, respondendo 201", async () => {
    service.criarEConectar.mockResolvedValue({
      instancia: { id: "instancia-1" },
      qrcode: "qr-base64",
      paircode: "1234",
    } as never);

    const response = await post(payloadValido);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(service.criarEConectar).toHaveBeenCalledWith(ctx, { nome: "Instância Principal" });
    expect(body).toEqual({
      instancia: { id: "instancia-1" },
      qrcode: "qr-base64",
      paircode: "1234",
    });
  });

  it("retorna 400 com detalhes de campo quando o nome é vazio", async () => {
    const response = await post({ nome: "" });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.detalhes.nome).toBeDefined();
    expect(service.criarEConectar).not.toHaveBeenCalled();
  });

  it("retorna 400 quando o body não é JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/instancias", { method: "POST", body: "nao-e-json" })
    );
    expect(response.status).toBe(400);
  });

  it("retorna 403 quando o role não tem permissão de gestão", async () => {
    const { PermissaoNegadaError } = jest.requireMock("@/services/instancia-whatsapp.service");
    service.criarEConectar.mockRejectedValue(new PermissaoNegadaError());

    const response = await post(payloadValido);
    expect(response.status).toBe(403);
  });

  it("retorna 409 quando o nome já existe no escritório", async () => {
    const { NomeInstanciaDuplicadoError } = jest.requireMock(
      "@/services/instancia-whatsapp.service"
    );
    service.criarEConectar.mockRejectedValue(new NomeInstanciaDuplicadoError());

    const response = await post(payloadValido);
    expect(response.status).toBe(409);
  });

  it("retorna 502 quando a UAZAPI está indisponível", async () => {
    const { UazapiIndisponivelError } = jest.requireMock("@/lib/external/uazapi-client");
    service.criarEConectar.mockRejectedValue(new UazapiIndisponivelError());

    const response = await post(payloadValido);
    expect(response.status).toBe(502);
  });

  it("retorna 500 sem vazar detalhe interno em erro inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.criarEConectar.mockRejectedValue(new Error("connection reset by peer"));

    const response = await post(payloadValido);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).not.toMatch(/connection reset/);
  });
});
