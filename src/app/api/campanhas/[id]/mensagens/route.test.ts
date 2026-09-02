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
    campanhaService: { listarMensagens: jest.fn() },
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

function get(query = "") {
  return GET(
    new Request(`http://localhost/api/campanhas/campanha-1/mensagens${query}`),
    { params }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
  service.listarMensagens.mockResolvedValue({
    mensagens: [
      { numero: "5511999998888", status: "enviada", erro: null, enviadaEm: new Date(0) },
    ],
    total: 1,
    truncado: false,
  } as never);
});

describe("GET /api/campanhas/[id]/mensagens", () => {
  it("retorna 401 sem sessão", async () => {
    const { NaoAutenticadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    expect((await get()).status).toBe(401);
  });

  // Consultar status é leitura: qualquer papel do escritório pode.
  it("devolve as mensagens, inclusive para role padrao", async () => {
    const response = await get();

    expect(service.listarMensagens).toHaveBeenCalledWith(ctx, "campanha-1", { pagina: 1 });
    await expect(response.json()).resolves.toEqual({
      mensagens: [
        {
          numero: "5511999998888",
          status: "enviada",
          erro: null,
          enviadaEm: "1970-01-01T00:00:00.000Z",
        },
      ],
      total: 1,
      truncado: false,
    });
  });

  it("repassa a página pedida ao service", async () => {
    await get("?pagina=3");

    expect(service.listarMensagens).toHaveBeenCalledWith(ctx, "campanha-1", { pagina: 3 });
  });

  // Mesmo comportamento tolerante da listagem de itens: página inválida vira a primeira,
  // em vez de devolver 400 por causa de um parâmetro de navegação.
  it.each(["?pagina=abc", "?pagina=0", "?pagina=-2"])(
    "trata %s como primeira página",
    async (query) => {
      await get(query);

      expect(service.listarMensagens).toHaveBeenCalledWith(ctx, "campanha-1", { pagina: 1 });
    }
  );

  it("retorna 404 para campanha de outro escritório", async () => {
    const { CampanhaNaoEncontradaError } = jest.requireMock("@/services/campanha.service");
    service.listarMensagens.mockRejectedValue(new CampanhaNaoEncontradaError("não encontrada"));

    expect((await get()).status).toBe(404);
  });

  it("retorna 409 quando a instância da campanha não existe mais", async () => {
    const { CampanhaSemInstanciaError } = jest.requireMock("@/services/campanha.service");
    service.listarMensagens.mockRejectedValue(new CampanhaSemInstanciaError("sem instância"));

    expect((await get()).status).toBe(409);
  });

  it("retorna 502 quando a UAZAPI está indisponível", async () => {
    const { UazapiIndisponivelError } = jest.requireMock("@/lib/external/uazapi-client");
    service.listarMensagens.mockRejectedValue(new UazapiIndisponivelError("fora do ar"));

    expect((await get()).status).toBe(502);
  });

  it("retorna 500 genérico em erro inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.listarMensagens.mockRejectedValue(new Error("boom"));

    const response = await get();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Não foi possível consultar o status das mensagens.",
    });
  });
});
