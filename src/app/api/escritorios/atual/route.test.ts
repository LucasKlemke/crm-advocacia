/**
 * @jest-environment node
 */
import { GET, PATCH } from "./route";
import { getTenantContext, NaoAutenticadoError, SemEscritorioAtivoError, AcessoNegadoError } from "@/lib/auth/tenant-context";
import {
  escritorioService,
  EscritorioNaoEncontradoError,
  PermissaoNegadaError,
} from "@/services/escritorio.service";

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
jest.mock("@/services/escritorio.service", () => {
  const actual = jest.requireActual("@/services/escritorio.service");
  return {
    ...actual,
    escritorioService: { obterEscritorioAtivo: jest.fn(), atualizarEscritorio: jest.fn() },
  };
});

const mockedGetTenantContext = getTenantContext as jest.Mock;
const mockedService = escritorioService as jest.Mocked<typeof escritorioService>;

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "owner" as const };

function buildPatchRequest(body: unknown) {
  return new Request("http://localhost/api/escritorios/atual", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("GET /api/escritorios/atual", () => {
  afterEach(() => jest.clearAllMocks());

  it("retorna 401 sem sessão", async () => {
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("retorna 409 sem escritório ativo", async () => {
    mockedGetTenantContext.mockRejectedValue(new SemEscritorioAtivoError());

    const response = await GET();

    expect(response.status).toBe(409);
  });

  it("retorna 403 quando o usuário não é membro do escritório", async () => {
    mockedGetTenantContext.mockRejectedValue(new AcessoNegadoError());

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it("retorna 404 quando o escritório não existe mais", async () => {
    mockedGetTenantContext.mockResolvedValue(ctx);
    mockedService.obterEscritorioAtivo.mockRejectedValue(new EscritorioNaoEncontradoError());

    const response = await GET();

    expect(response.status).toBe(404);
  });

  it("retorna 200 com os dados do escritório", async () => {
    mockedGetTenantContext.mockResolvedValue(ctx);
    mockedService.obterEscritorioAtivo.mockResolvedValue({ id: "esc-1", nome: "Escritório" } as never);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.escritorio.id).toBe("esc-1");
  });

  it("retorna 500 para erro inesperado", async () => {
    mockedGetTenantContext.mockResolvedValue(ctx);
    mockedService.obterEscritorioAtivo.mockRejectedValue(new Error("boom"));

    const response = await GET();

    expect(response.status).toBe(500);
  });
});

describe("PATCH /api/escritorios/atual", () => {
  afterEach(() => jest.clearAllMocks());

  it("retorna 401 sem sessão", async () => {
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    const response = await PATCH(buildPatchRequest({ nome: "Novo" }));

    expect(response.status).toBe(401);
  });

  it("retorna 400 para JSON inválido", async () => {
    mockedGetTenantContext.mockResolvedValue(ctx);

    const response = await PATCH(
      new Request("http://localhost/api/escritorios/atual", { method: "PATCH", body: "{x" })
    );

    expect(response.status).toBe(400);
  });

  it("retorna 400 para payload inválido", async () => {
    mockedGetTenantContext.mockResolvedValue(ctx);

    const response = await PATCH(buildPatchRequest({ nome: "" }));

    expect(response.status).toBe(400);
  });

  it("retorna 403 quando o service bloqueia (role padrao)", async () => {
    mockedGetTenantContext.mockResolvedValue(ctx);
    mockedService.atualizarEscritorio.mockRejectedValue(new PermissaoNegadaError());

    const response = await PATCH(buildPatchRequest({ nome: "Novo" }));

    expect(response.status).toBe(403);
  });

  it("retorna 200 com o escritório atualizado", async () => {
    mockedGetTenantContext.mockResolvedValue(ctx);
    mockedService.atualizarEscritorio.mockResolvedValue({ id: "esc-1", nome: "Novo" } as never);

    const response = await PATCH(buildPatchRequest({ nome: "Novo" }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.escritorio.nome).toBe("Novo");
  });

  it("retorna 500 para erro inesperado", async () => {
    mockedGetTenantContext.mockResolvedValue(ctx);
    mockedService.atualizarEscritorio.mockRejectedValue(new Error("boom"));

    const response = await PATCH(buildPatchRequest({ nome: "Novo" }));

    expect(response.status).toBe(500);
  });
});
