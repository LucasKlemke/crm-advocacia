/**
 * @jest-environment node
 */
import { GET, POST } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { statusService } from "@/services/status.service";

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
jest.mock("@/services/status.service", () => {
  class StatusNaoEncontradoError extends Error {}
  class NomeStatusDuplicadoError extends Error {}
  class TipoStatusInvalidoError extends Error {}
  class StatusComCasosError extends Error {}
  class PermissaoNegadaError extends Error {}
  return {
    statusService: { listar: jest.fn(), criar: jest.fn() },
    StatusNaoEncontradoError,
    NomeStatusDuplicadoError,
    TipoStatusInvalidoError,
    StatusComCasosError,
    PermissaoNegadaError,
  };
});

const mockedGetTenantContext = getTenantContext as jest.Mock;
const service = statusService as jest.Mocked<typeof statusService>;

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "owner" as const };
const TIPO_ID = "123e4567-e89b-12d3-a456-426614174000";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/status", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
});

describe("GET /api/status", () => {
  it("retorna 401 sem sessão", async () => {
    const { NaoAutenticadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("lista os status do escritório", async () => {
    service.listar.mockResolvedValue([{ id: "status-1" }] as never);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(service.listar).toHaveBeenCalledWith(ctx);
    expect((await response.json()).status).toEqual([{ id: "status-1" }]);
  });
});

describe("POST /api/status", () => {
  const payloadValido = {
    nome: "Novo Status",
    tipoStatusId: TIPO_ID,
    icone: "MessageCircle",
    cor: "#64748b",
  };

  it("cria o status e responde 201", async () => {
    service.criar.mockResolvedValue({ id: "status-1" } as never);

    const response = await post(payloadValido);

    expect(response.status).toBe(201);
    expect(service.criar).toHaveBeenCalledWith(ctx, expect.objectContaining({ nome: "Novo Status" }));
  });

  it("retorna 400 com detalhes de campo quando o payload é inválido", async () => {
    const response = await post({ ...payloadValido, icone: "IconeInexistente" });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.detalhes.icone).toBeDefined();
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("retorna 400 quando tipoStatusId não é um uuid", async () => {
    const response = await post({ ...payloadValido, tipoStatusId: "nao-e-uuid" });

    expect(response.status).toBe(400);
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("retorna 400 quando o body não é JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/status", { method: "POST", body: "nao-e-json" })
    );
    expect(response.status).toBe(400);
  });

  it("retorna 403 quando o role não tem permissão de gestão", async () => {
    const { PermissaoNegadaError } = jest.requireMock("@/services/status.service");
    service.criar.mockRejectedValue(new PermissaoNegadaError());

    const response = await post(payloadValido);
    expect(response.status).toBe(403);
  });

  it("retorna 409 quando o nome já existe no escritório", async () => {
    const { NomeStatusDuplicadoError } = jest.requireMock("@/services/status.service");
    service.criar.mockRejectedValue(new NomeStatusDuplicadoError());

    const response = await post(payloadValido);
    expect(response.status).toBe(409);
  });

  it("retorna 500 sem vazar detalhe interno em erro inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.criar.mockRejectedValue(new Error("connection reset by peer"));

    const response = await post(payloadValido);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).not.toMatch(/connection reset/);
  });
});
