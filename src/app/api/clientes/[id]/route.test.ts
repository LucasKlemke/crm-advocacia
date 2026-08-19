/**
 * @jest-environment node
 */
import { GET, PATCH } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { clienteService } from "@/services/cliente.service";

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
jest.mock("@/services/cliente.service", () => {
  class ClienteNaoEncontradoError extends Error {}
  class CpfInvalidoError extends Error {}
  class CpfDuplicadoError extends Error {}
  return {
    clienteService: { obter: jest.fn(), atualizar: jest.fn() },
    ClienteNaoEncontradoError,
    CpfInvalidoError,
    CpfDuplicadoError,
  };
});

const mockedGetTenantContext = getTenantContext as jest.Mock;
const service = clienteService as jest.Mocked<typeof clienteService>;

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" as const };
const params = Promise.resolve({ id: "cli-1" });

function patch(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/clientes/cli-1", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    { params }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
});

describe("GET /api/clientes/[id]", () => {
  it("devolve o cliente do escritório", async () => {
    service.obter.mockResolvedValue({ id: "cli-1" } as never);

    const response = await GET(new Request("http://localhost/api/clientes/cli-1"), { params });

    expect(response.status).toBe(200);
    expect(service.obter).toHaveBeenCalledWith(ctx, "cli-1");
  });

  // RN19: cliente de outro tenant responde 404, nunca 403 — não confirma que existe.
  it("responde 404 para cliente de outro escritório", async () => {
    const { ClienteNaoEncontradoError } = jest.requireMock("@/services/cliente.service");
    service.obter.mockRejectedValue(new ClienteNaoEncontradoError());

    const response = await GET(new Request("http://localhost/api/clientes/cli-1"), { params });
    expect(response.status).toBe(404);
  });

  it("responde 401 sem sessão", async () => {
    const { NaoAutenticadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    const response = await GET(new Request("http://localhost/api/clientes/cli-1"), { params });
    expect(response.status).toBe(401);
  });
});

describe("PATCH /api/clientes/[id]", () => {
  it("atualiza apenas os campos enviados", async () => {
    service.atualizar.mockResolvedValue({ id: "cli-1" } as never);

    const response = await patch({ telefone: "48988887777" });

    expect(response.status).toBe(200);
    expect(service.atualizar).toHaveBeenCalledWith(ctx, "cli-1", { telefone: "48988887777" });
  });

  it("aceita null para limpar um campo opcional", async () => {
    service.atualizar.mockResolvedValue({ id: "cli-1" } as never);

    await patch({ telefone: null });

    expect(service.atualizar).toHaveBeenCalledWith(ctx, "cli-1", { telefone: null });
  });

  it("responde 400 com detalhes quando o nome é curto demais", async () => {
    const response = await patch({ nome: "Ma" });

    expect(response.status).toBe(400);
    expect((await response.json()).detalhes.nome).toBeDefined();
  });

  it("responde 409 em colisão de CPF", async () => {
    const { CpfDuplicadoError } = jest.requireMock("@/services/cliente.service");
    service.atualizar.mockRejectedValue(new CpfDuplicadoError());

    const response = await patch({ cpf: "529.982.247-25" });
    expect(response.status).toBe(409);
  });
});
