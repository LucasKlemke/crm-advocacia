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
    campanhaService: { controlar: jest.fn() },
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

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/campanhas/campanha-1/controlar", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
  service.controlar.mockResolvedValue({ id: "campanha-1" } as never);
});

describe("POST /api/campanhas/[id]/controlar", () => {
  it("repassa a ação ao service", async () => {
    const response = await post({ acao: "stop" });

    expect(service.controlar).toHaveBeenCalledWith(ctx, "campanha-1", "stop");
    expect(response.status).toBe(200);
  });

  // Depois de excluir não sobra linha local; o client usa isso para tirar a campanha da lista.
  it("devolve campanha null quando a ação foi delete", async () => {
    service.controlar.mockResolvedValue(null);

    await expect((await post({ acao: "delete" })).json()).resolves.toEqual({ campanha: null });
  });

  it("retorna 400 para ação desconhecida", async () => {
    expect((await post({ acao: "explodir" })).status).toBe(400);
    expect(service.controlar).not.toHaveBeenCalled();
  });

  it("retorna 400 com body malformado", async () => {
    const response = await POST(
      new Request("http://localhost/api/campanhas/campanha-1/controlar", {
        method: "POST",
        body: "{nao-e-json",
      }),
      { params }
    );

    expect(response.status).toBe(400);
  });

  it("retorna 403 para role sem permissão de gestão", async () => {
    const { PermissaoNegadaError } = jest.requireMock("@/services/campanha.service");
    service.controlar.mockRejectedValue(new PermissaoNegadaError("sem permissão"));

    expect((await post({ acao: "stop" })).status).toBe(403);
  });

  it("retorna 409 quando a campanha perdeu a instância que a disparou", async () => {
    const { CampanhaSemInstanciaError } = jest.requireMock("@/services/campanha.service");
    service.controlar.mockRejectedValue(new CampanhaSemInstanciaError("sem instância"));

    expect((await post({ acao: "stop" })).status).toBe(409);
  });

  it("retorna 502 quando a UAZAPI recusa a ação", async () => {
    const { UazapiIndisponivelError } = jest.requireMock("@/lib/external/uazapi-client");
    service.controlar.mockRejectedValue(new UazapiIndisponivelError("fora do ar"));

    expect((await post({ acao: "continue" })).status).toBe(502);
  });
});
