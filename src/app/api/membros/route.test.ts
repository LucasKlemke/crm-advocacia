/**
 * @jest-environment node
 */
import { GET } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { membroService } from "@/services/membro.service";

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
jest.mock("@/services/membro.service", () => ({
  membroService: { listarMembros: jest.fn() },
}));

const mockedGetTenantContext = getTenantContext as jest.Mock;
const mockedService = membroService as jest.Mocked<typeof membroService>;

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "owner" as const };

describe("GET /api/membros", () => {
  afterEach(() => jest.clearAllMocks());

  it("retorna 401 sem sessão", async () => {
    const { NaoAutenticadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("retorna 409 sem escritório ativo", async () => {
    const { SemEscritorioAtivoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new SemEscritorioAtivoError());

    const response = await GET();

    expect(response.status).toBe(409);
  });

  it("retorna 403 quando o usuário não é membro do escritório", async () => {
    const { AcessoNegadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new AcessoNegadoError());

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it("retorna 200 com a lista de membros", async () => {
    mockedGetTenantContext.mockResolvedValue(ctx);
    mockedService.listarMembros.mockResolvedValue([{ id: "membro-1" }] as never);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.membros).toEqual([{ id: "membro-1" }]);
  });

  it("retorna 500 para erro inesperado", async () => {
    mockedGetTenantContext.mockResolvedValue(ctx);
    mockedService.listarMembros.mockRejectedValue(new Error("boom"));

    const response = await GET();

    expect(response.status).toBe(500);
  });
});
