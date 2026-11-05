/**
 * @jest-environment node
 */
import { montarOpcoesFiltroCaso } from "./casos-filtros";
import { clienteRepository } from "@dominio/repositories/cliente.repository";
import { membroRepository } from "@dominio/repositories/membro.repository";
import { statusRepository } from "@dominio/repositories/status.repository";
import { tipoStatusRepository } from "@dominio/repositories/tipo-status.repository";
import { tipoProcessoRepository } from "@dominio/repositories/tipo-processo.repository";

jest.mock("@dominio/repositories/cliente.repository", () => ({ clienteRepository: { listar: jest.fn() } }));
jest.mock("@dominio/repositories/membro.repository", () => ({
  membroRepository: { listarComUsuarioPorEscritorio: jest.fn() },
}));
jest.mock("@dominio/repositories/status.repository", () => ({ statusRepository: { listar: jest.fn() } }));
jest.mock("@dominio/repositories/tipo-status.repository", () => ({ tipoStatusRepository: { listar: jest.fn() } }));
jest.mock("@dominio/repositories/tipo-processo.repository", () => ({
  tipoProcessoRepository: { listar: jest.fn() },
}));
jest.mock("@dominio/services/usuario.service", () => ({ usuarioService: { assinarUrlAvatar: jest.fn() } }));

const clientes = clienteRepository as jest.Mocked<typeof clienteRepository>;
const membros = membroRepository as jest.Mocked<typeof membroRepository>;
const status = statusRepository as jest.Mocked<typeof statusRepository>;
const tipos = tipoStatusRepository as jest.Mocked<typeof tipoStatusRepository>;
const tiposProcesso = tipoProcessoRepository as jest.Mocked<typeof tipoProcessoRepository>;
const { usuarioService } = jest.requireMock("@dominio/services/usuario.service");

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" as const };

beforeEach(() => jest.clearAllMocks());

describe("montarOpcoesFiltroCaso", () => {
  it("monta o payload único de opções de filtro, escopado ao escritório e com avatar assinado", async () => {
    clientes.listar.mockResolvedValue([{ id: "cliente-1", nome: "Maria", cpf: "52998224725" }] as never);
    membros.listarComUsuarioPorEscritorio.mockResolvedValue([
      { id: "membro-1", usuario: { nome: "Advogado", avatarUrl: "development/avatares/user-1/foto.png" } },
    ] as never);
    status.listar.mockResolvedValue([{ id: "status-1", nome: "Novo", cor: "#000" }] as never);
    tipos.listar.mockResolvedValue([{ id: "tipo-1", nome: "Lead", chave: "lead", cor: "#111" }] as never);
    tiposProcesso.listar.mockResolvedValue([
      { id: "tipo-processo-1", nome: "Ação de cobrança", cor: "#222", icone: "Briefcase" },
    ] as never);
    usuarioService.assinarUrlAvatar.mockResolvedValue("https://bucket.s3.amazonaws.com/signed-get");

    const payload = JSON.parse(JSON.stringify(await montarOpcoesFiltroCaso(ctx)));

    expect(payload).toEqual({
      clientes: [{ id: "cliente-1", nome: "Maria", cpf: "52998224725" }],
      membros: [{ id: "membro-1", nome: "Advogado", avatarUrl: "https://bucket.s3.amazonaws.com/signed-get" }],
      status: [{ id: "status-1", nome: "Novo", cor: "#000" }],
      tipos: [{ id: "tipo-1", nome: "Lead", chave: "lead", cor: "#111" }],
      tiposProcesso: [{ id: "tipo-processo-1", nome: "Ação de cobrança", cor: "#222", icone: "Briefcase" }],
    });
    expect(clientes.listar).toHaveBeenCalledWith("esc-1");
    expect(status.listar).toHaveBeenCalledWith("esc-1");
    expect(tiposProcesso.listar).toHaveBeenCalledWith("esc-1");
    expect(usuarioService.assinarUrlAvatar).toHaveBeenCalledWith("development/avatares/user-1/foto.png");
  });
});
