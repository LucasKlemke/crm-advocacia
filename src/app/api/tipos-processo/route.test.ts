/**
 * @jest-environment node
 */
import { GET, POST } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { tipoProcessoService } from "@/services/tipo-processo.service";

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
jest.mock("@/services/tipo-processo.service", () => {
  class TipoProcessoNaoEncontradoError extends Error {}
  class NomeTipoProcessoDuplicadoError extends Error {}
  class TipoProcessoComCasosError extends Error {}
  class PermissaoNegadaError extends Error {}
  return {
    tipoProcessoService: { listar: jest.fn(), criar: jest.fn() },
    TipoProcessoNaoEncontradoError,
    NomeTipoProcessoDuplicadoError,
    TipoProcessoComCasosError,
    PermissaoNegadaError,
  };
});

const mockedGetTenantContext = getTenantContext as jest.Mock;
const service = tipoProcessoService as jest.Mocked<typeof tipoProcessoService>;

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "owner" as const };
const VALIDO = { nome: "Juros abusivos", icone: "Briefcase", cor: "#6366f1" };

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/tipos-processo", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
});

describe("GET /api/tipos-processo", () => {
  it("lista os tipos do escritório", async () => {
    service.listar.mockResolvedValue([{ id: "tipo-processo-1" }] as never);

    const response = await GET();
    const corpo = await response.json();

    expect(response.status).toBe(200);
    expect(corpo).toEqual({ tipos: [{ id: "tipo-processo-1" }] });
    expect(service.listar).toHaveBeenCalledWith(ctx);
  });

  it("retorna 401 sem sessão", async () => {
    const { NaoAutenticadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    expect((await GET()).status).toBe(401);
  });
});

describe("POST /api/tipos-processo", () => {
  it("cria o tipo e responde 201", async () => {
    service.criar.mockResolvedValue({ id: "tipo-processo-1" } as never);

    const response = await post(VALIDO);

    expect(response.status).toBe(201);
    expect(service.criar).toHaveBeenCalledWith(ctx, expect.objectContaining(VALIDO));
  });

  it("responde 400 para payload inválido", async () => {
    const response = await post({ ...VALIDO, cor: "#abcdef" });

    expect(response.status).toBe(400);
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("responde 403 quando o papel não pode configurar o escritório", async () => {
    const { PermissaoNegadaError } = jest.requireMock("@/services/tipo-processo.service");
    service.criar.mockRejectedValue(new PermissaoNegadaError());

    expect((await post(VALIDO)).status).toBe(403);
  });

  it("responde 409 quando o nome já existe no escritório", async () => {
    const { NomeTipoProcessoDuplicadoError } = jest.requireMock(
      "@/services/tipo-processo.service"
    );
    service.criar.mockRejectedValue(new NomeTipoProcessoDuplicadoError());

    expect((await post(VALIDO)).status).toBe(409);
  });
});
