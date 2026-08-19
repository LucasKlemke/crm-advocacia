/**
 * @jest-environment node
 */
import { POST } from "./route";
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
    clienteService: { desativarEmLote: jest.fn(), restaurarEmLote: jest.fn() },
    ClienteNaoEncontradoError,
    CpfInvalidoError,
    CpfDuplicadoError,
  };
});

const mockedGetTenantContext = getTenantContext as jest.Mock;
const service = clienteService as jest.Mocked<typeof clienteService>;

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" as const };
const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/clientes/lote", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
});

describe("POST /api/clientes/lote", () => {
  it("desativa os clientes selecionados", async () => {
    service.desativarEmLote.mockResolvedValue({ desativados: 2, ignorados: 0 });

    const response = await post({ ids: [ID_A, ID_B], acao: "desativar" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ desativados: 2, ignorados: 0 });
    expect(service.desativarEmLote).toHaveBeenCalledWith(ctx, [ID_A, ID_B]);
  });

  it("restaura quando a ação é restaurar", async () => {
    service.restaurarEmLote.mockResolvedValue({ restaurados: 1, ignorados: 0 });

    await post({ ids: [ID_A], acao: "restaurar" });

    expect(service.restaurarEmLote).toHaveBeenCalledWith(ctx, [ID_A]);
    expect(service.desativarEmLote).not.toHaveBeenCalled();
  });

  it("recusa lista vazia", async () => {
    const response = await post({ ids: [], acao: "desativar" });
    expect(response.status).toBe(400);
    expect(service.desativarEmLote).not.toHaveBeenCalled();
  });

  it("recusa ação desconhecida", async () => {
    const response = await post({ ids: [ID_A], acao: "excluir-de-vez" });
    expect(response.status).toBe(400);
  });

  it("recusa ids que não são uuid", async () => {
    const response = await post({ ids: ["'; drop table cliente; --"], acao: "desativar" });
    expect(response.status).toBe(400);
  });

  it("responde 401 sem sessão", async () => {
    const { NaoAutenticadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    const response = await post({ ids: [ID_A], acao: "desativar" });
    expect(response.status).toBe(401);
  });
});
