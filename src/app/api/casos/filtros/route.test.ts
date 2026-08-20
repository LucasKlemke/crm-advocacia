/**
 * @jest-environment node
 */
import { GET } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { clienteRepository } from "@/repositories/cliente.repository";
import { membroRepository } from "@/repositories/membro.repository";
import { statusRepository } from "@/repositories/status.repository";
import { tipoStatusRepository } from "@/repositories/tipo-status.repository";

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
jest.mock("@/repositories/cliente.repository", () => ({
  clienteRepository: { listar: jest.fn() },
}));
jest.mock("@/repositories/membro.repository", () => ({
  membroRepository: { listarComUsuarioPorEscritorio: jest.fn() },
}));
jest.mock("@/repositories/status.repository", () => ({
  statusRepository: { listar: jest.fn() },
}));
jest.mock("@/repositories/tipo-status.repository", () => ({
  tipoStatusRepository: { listar: jest.fn() },
}));

const mockedGetTenantContext = getTenantContext as jest.Mock;
const clientes = clienteRepository as jest.Mocked<typeof clienteRepository>;
const membros = membroRepository as jest.Mocked<typeof membroRepository>;
const status = statusRepository as jest.Mocked<typeof statusRepository>;
const tipos = tipoStatusRepository as jest.Mocked<typeof tipoStatusRepository>;

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" as const };

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
});

describe("GET /api/casos/filtros", () => {
  it("monta o payload único de opções de filtro", async () => {
    clientes.listar.mockResolvedValue([
      { id: "cliente-1", nome: "Maria", cpf: "52998224725" },
    ] as never);
    membros.listarComUsuarioPorEscritorio.mockResolvedValue([
      { id: "membro-1", usuario: { nome: "Advogado" } },
    ] as never);
    status.listar.mockResolvedValue([{ id: "status-1", nome: "Novo", cor: "#000" }] as never);
    tipos.listar.mockResolvedValue([
      { id: "tipo-1", nome: "Novo", chave: "nova_conversa", cor: "#111" },
    ] as never);

    const response = await GET();
    const corpo = await response.json();

    expect(response.status).toBe(200);
    expect(corpo).toEqual({
      clientes: [{ id: "cliente-1", nome: "Maria", cpf: "52998224725" }],
      membros: [{ id: "membro-1", nome: "Advogado" }],
      status: [{ id: "status-1", nome: "Novo", cor: "#000" }],
      tipos: [{ id: "tipo-1", nome: "Novo", chave: "nova_conversa", cor: "#111" }],
    });
    expect(clientes.listar).toHaveBeenCalledWith("esc-1");
  });

  it("responde 401 sem sessão", async () => {
    const { NaoAutenticadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    const response = await GET();
    expect(response.status).toBe(401);
  });
});
