/**
 * @jest-environment node
 */
import { GET } from "./route";
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
    campanhaService: { obter: jest.fn(), listarItens: jest.fn() },
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

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "owner" as const };
const params = Promise.resolve({ id: "campanha-1" });

function get(url = "http://localhost/api/campanhas/campanha-1") {
  return GET(new Request(url), { params });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
  service.obter.mockResolvedValue({ id: "campanha-1" } as never);
  service.listarItens.mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 50 });
});

describe("GET /api/campanhas/[id]", () => {
  it("retorna 401 sem sessão", async () => {
    const { NaoAutenticadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    expect((await get()).status).toBe(401);
  });

  it("devolve a campanha junto da primeira página de itens", async () => {
    const response = await get();

    expect(service.obter).toHaveBeenCalledWith(ctx, "campanha-1");
    expect(service.listarItens).toHaveBeenCalledWith(ctx, "campanha-1", { pagina: 1 });
    await expect(response.json()).resolves.toEqual({
      campanha: { id: "campanha-1" },
      itens: [],
      total: 0,
      pagina: 1,
      porPagina: 50,
    });
  });

  it("respeita ?pagina=", async () => {
    await get("http://localhost/api/campanhas/campanha-1?pagina=3");

    expect(service.listarItens).toHaveBeenCalledWith(ctx, "campanha-1", { pagina: 3 });
  });

  // O schema usa .catch(1): página inválida vira a primeira em vez de derrubar a tela.
  it("cai para a página 1 quando ?pagina= é inválido", async () => {
    await get("http://localhost/api/campanhas/campanha-1?pagina=abc");

    expect(service.listarItens).toHaveBeenCalledWith(ctx, "campanha-1", { pagina: 1 });
  });

  it("retorna 404 para campanha de outro escritório", async () => {
    const { CampanhaNaoEncontradaError } = jest.requireMock("@/services/campanha.service");
    service.obter.mockRejectedValue(new CampanhaNaoEncontradaError("não encontrada"));

    expect((await get()).status).toBe(404);
  });
});
