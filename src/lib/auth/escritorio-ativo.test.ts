import { resolverEscritorioAtivo } from "./escritorio-ativo";
import { membroRepository } from "@/repositories/membro.repository";

jest.mock("@/repositories/membro.repository");

const mockedMembroRepo = membroRepository as jest.Mocked<typeof membroRepository>;

describe("resolverEscritorioAtivo", () => {
  afterEach(() => jest.clearAllMocks());

  it("usa o escritório desejado quando o usuário é membro dele e ele está ativo", async () => {
    mockedMembroRepo.listarComEscritorioPorUsuario.mockResolvedValue([
      { escritorioId: "esc-1", role: "owner", escritorio: { ativo: true } },
      { escritorioId: "esc-2", role: "admin", escritorio: { ativo: true } },
    ] as never);

    const resultado = await resolverEscritorioAtivo("user-1", "esc-2");

    expect(resultado).toEqual({ escritorioId: "esc-2", role: "admin" });
  });

  it("cai para a membership ativa mais antiga quando o desejado não é uma membership válida", async () => {
    mockedMembroRepo.listarComEscritorioPorUsuario.mockResolvedValue([
      { escritorioId: "esc-1", role: "owner", escritorio: { ativo: true } },
      { escritorioId: "esc-2", role: "padrao", escritorio: { ativo: true } },
    ] as never);

    const resultado = await resolverEscritorioAtivo("user-1", "esc-999");

    expect(resultado).toEqual({ escritorioId: "esc-1", role: "owner" });
  });

  it("cai para a membership ativa mais antiga quando nenhum escritório desejado é informado", async () => {
    mockedMembroRepo.listarComEscritorioPorUsuario.mockResolvedValue([
      { escritorioId: "esc-1", role: "owner", escritorio: { ativo: true } },
    ] as never);

    const resultado = await resolverEscritorioAtivo("user-1", null);

    expect(resultado).toEqual({ escritorioId: "esc-1", role: "owner" });
  });

  it("retorna null/null quando o usuário não tem nenhuma membership", async () => {
    mockedMembroRepo.listarComEscritorioPorUsuario.mockResolvedValue([]);

    const resultado = await resolverEscritorioAtivo("user-1", undefined);

    expect(resultado).toEqual({ escritorioId: null, role: null });
  });

  it("ignora o escritório desejado se ele estiver inativo e cai para outra membership ativa", async () => {
    mockedMembroRepo.listarComEscritorioPorUsuario.mockResolvedValue([
      { escritorioId: "esc-1", role: "owner", escritorio: { ativo: true } },
      { escritorioId: "esc-2", role: "admin", escritorio: { ativo: false } },
    ] as never);

    const resultado = await resolverEscritorioAtivo("user-1", "esc-2");

    expect(resultado).toEqual({ escritorioId: "esc-1", role: "owner" });
  });

  it("retorna null/null quando todas as memberships do usuário são de escritórios inativos", async () => {
    mockedMembroRepo.listarComEscritorioPorUsuario.mockResolvedValue([
      { escritorioId: "esc-1", role: "owner", escritorio: { ativo: false } },
    ] as never);

    const resultado = await resolverEscritorioAtivo("user-1", null);

    expect(resultado).toEqual({ escritorioId: null, role: null });
  });
});
