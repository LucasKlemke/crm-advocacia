/**
 * @jest-environment node
 */
import { GET, POST } from "./route";
import {
  getTenantContext,
  NaoAutenticadoError,
  SemEscritorioAtivoError,
  AcessoNegadoError,
} from "@/lib/auth/tenant-context";
import {
  conviteService,
  PermissaoNegadaError,
  ConviteJaExisteError,
  JaEhMembroError,
} from "@/services/convite.service";

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
jest.mock("@/services/convite.service", () => {
  const actual = jest.requireActual("@/services/convite.service");
  return { ...actual, conviteService: { listarPendentes: jest.fn(), convidar: jest.fn() } };
});

const mockedGetTenantContext = getTenantContext as jest.Mock;
const mockedService = conviteService as jest.Mocked<typeof conviteService>;

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "owner" as const };

function buildPostRequest(body: unknown) {
  return new Request("http://localhost/api/convites", { method: "POST", body: JSON.stringify(body) });
}

describe("GET /api/convites", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetTenantContext.mockResolvedValue(ctx);
  });

  it("retorna 403 quando o service bloqueia (padrao)", async () => {
    mockedService.listarPendentes.mockRejectedValue(new PermissaoNegadaError());

    const response = await GET();

    expect(response.status).toBe(403);
  });

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

  it("retorna 200 com os convites pendentes", async () => {
    mockedService.listarPendentes.mockResolvedValue([{ id: "convite-1" }] as never);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.convites).toEqual([{ id: "convite-1" }]);
  });

  it("retorna 500 para erro inesperado", async () => {
    mockedService.listarPendentes.mockRejectedValue(new Error("boom"));

    const response = await GET();

    expect(response.status).toBe(500);
  });
});

describe("POST /api/convites", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetTenantContext.mockResolvedValue(ctx);
  });

  it("retorna 400 para JSON inválido", async () => {
    const response = await POST(
      new Request("http://localhost/api/convites", { method: "POST", body: "{x" })
    );

    expect(response.status).toBe(400);
    expect(mockedService.convidar).not.toHaveBeenCalled();
  });

  it("retorna 400 para payload inválido", async () => {
    const response = await POST(buildPostRequest({ email: "invalido" }));

    expect(response.status).toBe(400);
    expect(mockedService.convidar).not.toHaveBeenCalled();
  });

  it("retorna 401 sem sessão", async () => {
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    const response = await POST(buildPostRequest({ email: "novo@teste.com", role: "padrao" }));

    expect(response.status).toBe(401);
  });

  it("retorna 403 quando a permissão é negada", async () => {
    mockedService.convidar.mockRejectedValue(new PermissaoNegadaError());

    const response = await POST(buildPostRequest({ email: "novo@teste.com", role: "padrao" }));

    expect(response.status).toBe(403);
  });

  it("retorna 409 quando já existe convite pendente", async () => {
    mockedService.convidar.mockRejectedValue(new ConviteJaExisteError());

    const response = await POST(buildPostRequest({ email: "novo@teste.com", role: "padrao" }));

    expect(response.status).toBe(409);
  });

  it("retorna 409 quando o e-mail já é membro", async () => {
    mockedService.convidar.mockRejectedValue(new JaEhMembroError());

    const response = await POST(buildPostRequest({ email: "novo@teste.com", role: "padrao" }));

    expect(response.status).toBe(409);
  });

  it("retorna 201 com o resultado do convite", async () => {
    mockedService.convidar.mockResolvedValue({ tipo: "convite", convite: { id: "convite-1" } } as never);

    const response = await POST(buildPostRequest({ email: "novo@teste.com", role: "padrao" }));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.tipo).toBe("convite");
  });

  it("retorna 500 para erro inesperado", async () => {
    mockedService.convidar.mockRejectedValue(new Error("boom"));

    const response = await POST(buildPostRequest({ email: "novo@teste.com", role: "padrao" }));

    expect(response.status).toBe(500);
  });
});
