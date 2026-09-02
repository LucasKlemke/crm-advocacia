/**
 * @jest-environment node
 */
import { POST } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { campanhaService } from "@/services/campanha.service";

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
jest.mock("@/services/campanha.service", () => {
  class CampanhaNaoEncontradaError extends Error {}
  class CampanhaSemInstanciaError extends Error {}
  class DestinatariosInvalidosError extends Error {}
  class InstanciaNaoConectadaError extends Error {}
  class PermissaoNegadaError extends Error {}
  class VariavelSemColunaError extends Error {}
  return {
    campanhaService: { sincronizar: jest.fn() },
    CampanhaNaoEncontradaError,
    CampanhaSemInstanciaError,
    DestinatariosInvalidosError,
    InstanciaNaoConectadaError,
    PermissaoNegadaError,
    VariavelSemColunaError,
  };
});
jest.mock("@/services/instancia-whatsapp.service", () => {
  class InstanciaWhatsappNaoEncontradaError extends Error {}
  return { InstanciaWhatsappNaoEncontradaError };
});
jest.mock("@/lib/external/uazapi-client", () => {
  class UazapiIndisponivelError extends Error {}
  return { uazapiClient: {}, UazapiIndisponivelError };
});

const mockedGetTenantContext = getTenantContext as jest.Mock;
const service = campanhaService as jest.Mocked<typeof campanhaService>;

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" as const };
const params = Promise.resolve({ id: "campanha-1" });

function post() {
  return POST(
    new Request("http://localhost/api/campanhas/campanha-1/sincronizar", { method: "POST" }),
    { params }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
  service.sincronizar.mockResolvedValue({ id: "campanha-1", logSucesso: 7 } as never);
});

describe("POST /api/campanhas/[id]/sincronizar", () => {
  it("retorna 401 sem sessão", async () => {
    const { NaoAutenticadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    expect((await post()).status).toBe(401);
  });

  // Sincronizar é leitura de estado: qualquer papel do escritório pode disparar.
  it("devolve a campanha atualizada, inclusive para role padrao", async () => {
    const response = await post();

    expect(service.sincronizar).toHaveBeenCalledWith(ctx, "campanha-1");
    await expect(response.json()).resolves.toEqual({
      campanha: { id: "campanha-1", logSucesso: 7 },
    });
  });

  it("retorna 404 para campanha de outro escritório", async () => {
    const { CampanhaNaoEncontradaError } = jest.requireMock("@/services/campanha.service");
    service.sincronizar.mockRejectedValue(new CampanhaNaoEncontradaError("não encontrada"));

    expect((await post()).status).toBe(404);
  });

  it("retorna 502 quando a UAZAPI está indisponível", async () => {
    const { UazapiIndisponivelError } = jest.requireMock("@/lib/external/uazapi-client");
    service.sincronizar.mockRejectedValue(new UazapiIndisponivelError("fora do ar"));

    expect((await post()).status).toBe(502);
  });
});
