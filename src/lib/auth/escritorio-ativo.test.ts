import { resolverEscritorioAtivo } from "./escritorio-ativo";
import { membroRepository } from "@/repositories/membro.repository";

jest.mock("@/repositories/membro.repository");

const mockedMembroRepo = membroRepository as jest.Mocked<typeof membroRepository>;

describe("resolverEscritorioAtivo", () => {
  afterEach(() => jest.clearAllMocks());

  it("usa o escritório desejado quando o usuário é membro dele", async () => {
    mockedMembroRepo.findByUsuarioEEscritorio.mockResolvedValue({
      escritorioId: "esc-2",
      role: "admin",
    } as never);

    const resultado = await resolverEscritorioAtivo("user-1", "esc-2");

    expect(resultado).toEqual({ escritorioId: "esc-2", role: "admin" });
    expect(mockedMembroRepo.listarPorUsuario).not.toHaveBeenCalled();
  });

  it("cai para a membership mais antiga quando o desejado não é uma membership válida", async () => {
    mockedMembroRepo.findByUsuarioEEscritorio.mockResolvedValue(null);
    mockedMembroRepo.listarPorUsuario.mockResolvedValue([
      { escritorioId: "esc-1", role: "owner" },
      { escritorioId: "esc-2", role: "padrao" },
    ] as never);

    const resultado = await resolverEscritorioAtivo("user-1", "esc-999");

    expect(resultado).toEqual({ escritorioId: "esc-1", role: "owner" });
  });

  it("cai para a membership mais antiga quando nenhum escritório desejado é informado", async () => {
    mockedMembroRepo.listarPorUsuario.mockResolvedValue([
      { escritorioId: "esc-1", role: "owner" },
    ] as never);

    const resultado = await resolverEscritorioAtivo("user-1", null);

    expect(resultado).toEqual({ escritorioId: "esc-1", role: "owner" });
    expect(mockedMembroRepo.findByUsuarioEEscritorio).not.toHaveBeenCalled();
  });

  it("retorna null/null quando o usuário não tem nenhuma membership", async () => {
    mockedMembroRepo.listarPorUsuario.mockResolvedValue([]);

    const resultado = await resolverEscritorioAtivo("user-1", undefined);

    expect(resultado).toEqual({ escritorioId: null, role: null });
  });
});
