/**
 * @jest-environment node
 */
import { GET, POST } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { casoService } from "@/services/caso.service";

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
jest.mock("@/services/caso.service", () => {
  class CasoNaoEncontradoError extends Error {}
  class ClienteInativoError extends Error {}
  class ResponsavelInvalidoError extends Error {}
  return {
    casoService: { listar: jest.fn(), criar: jest.fn() },
    CasoNaoEncontradoError,
    ClienteInativoError,
    ResponsavelInvalidoError,
  };
});
jest.mock("@/services/cliente.service", () => {
  class ClienteNaoEncontradoError extends Error {}
  return { ClienteNaoEncontradoError };
});
jest.mock("@/services/status.service", () => {
  class StatusNaoEncontradoError extends Error {}
  return { StatusNaoEncontradoError };
});

const mockedGetTenantContext = getTenantContext as jest.Mock;
const service = casoService as jest.Mocked<typeof casoService>;

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" as const };
const CLIENTE_ID = "11111111-1111-4111-8111-111111111111";
const STATUS_ID = "22222222-2222-4222-8222-222222222222";

function post(body: unknown) {
  return POST(new Request("http://localhost/api/casos", { method: "POST", body: JSON.stringify(body) }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
});

describe("GET /api/casos", () => {
  it("lista os casos paginados com os filtros da query", async () => {
    service.listar.mockResolvedValue({ casos: [], total: 0 } as never);

    const response = await GET(
      new Request(`http://localhost/api/casos?busca=cobrança&statusId=${STATUS_ID}&pagina=2`)
    );
    const corpo = await response.json();

    expect(response.status).toBe(200);
    expect(corpo).toMatchObject({ total: 0, pagina: 2, porPagina: 20 });
    expect(service.listar).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ busca: "cobrança", statusIds: [STATUS_ID], skip: 20, take: 20 })
    );
  });

  it("responde 401 sem sessão", async () => {
    const { NaoAutenticadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    const response = await GET(new Request("http://localhost/api/casos"));
    expect(response.status).toBe(401);
  });

  it("responde 500 sem vazar detalhe interno em erro inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.listar.mockRejectedValue(new Error("connection reset by peer"));

    const response = await GET(new Request("http://localhost/api/casos"));
    const corpo = await response.json();

    expect(response.status).toBe(500);
    expect(corpo.error).not.toMatch(/connection reset/);
  });
});

describe("POST /api/casos", () => {
  it("cria o caso e responde 201", async () => {
    service.criar.mockResolvedValue({ id: "caso-1" } as never);

    const response = await post({ titulo: "Novo Caso", clienteId: CLIENTE_ID, statusId: STATUS_ID });
    const corpo = await response.json();

    expect(response.status).toBe(201);
    expect(corpo.caso).toEqual({ id: "caso-1" });
    expect(service.criar).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ titulo: "Novo Caso", clienteId: CLIENTE_ID, statusId: STATUS_ID })
    );
  });

  it("responde 400 quando o body não é JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/casos", { method: "POST", body: "nao-e-json" })
    );
    expect(response.status).toBe(400);
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("responde 400 para payload inválido (zod)", async () => {
    const response = await post({ titulo: "", clienteId: CLIENTE_ID, statusId: STATUS_ID });
    expect(response.status).toBe(400);
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("responde 404 quando o cliente não é do tenant", async () => {
    const { ClienteNaoEncontradoError } = jest.requireMock("@/services/cliente.service");
    service.criar.mockRejectedValue(new ClienteNaoEncontradoError());

    const response = await post({ titulo: "Novo Caso", clienteId: CLIENTE_ID, statusId: STATUS_ID });
    expect(response.status).toBe(404);
  });

  it("responde 400 quando o cliente está inativo", async () => {
    const { ClienteInativoError } = jest.requireMock("@/services/caso.service");
    service.criar.mockRejectedValue(new ClienteInativoError());

    const response = await post({ titulo: "Novo Caso", clienteId: CLIENTE_ID, statusId: STATUS_ID });
    expect(response.status).toBe(400);
  });

  it("responde 401 sem sessão", async () => {
    const { NaoAutenticadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    const response = await post({ titulo: "Novo Caso", clienteId: CLIENTE_ID, statusId: STATUS_ID });
    expect(response.status).toBe(401);
  });
});
