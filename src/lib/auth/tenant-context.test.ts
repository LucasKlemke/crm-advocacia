import { getTenantContext, NaoAutenticadoError, SemEscritorioAtivoError, AcessoNegadoError } from "./tenant-context";
import { lerSessaoDoServidor } from "@/lib/auth/sessao-servidor";
import { membroRepository } from "@/repositories/membro.repository";

jest.mock("@/lib/auth/sessao-servidor", () => ({ lerSessaoDoServidor: jest.fn() }));
jest.mock("@/repositories/membro.repository");

const mockedLerSessao = lerSessaoDoServidor as jest.Mock;
const mockedMembroRepo = membroRepository as jest.Mocked<typeof membroRepository>;

describe("getTenantContext", () => {
  afterEach(() => jest.clearAllMocks());

  it("lança NaoAutenticadoError quando não há sessão (RN01)", async () => {
    mockedLerSessao.mockResolvedValue(null);

    await expect(getTenantContext()).rejects.toThrow(NaoAutenticadoError);
  });

  it("lança SemEscritorioAtivoError quando a sessão não tem escritório", async () => {
    mockedLerSessao.mockResolvedValue({ sub: "user-1", escritorioId: null });

    await expect(getTenantContext()).rejects.toThrow(SemEscritorioAtivoError);
  });

  it("lança AcessoNegadoError quando o usuário não é mais membro (RN19)", async () => {
    mockedLerSessao.mockResolvedValue({ sub: "user-1", escritorioId: "esc-1" });
    mockedMembroRepo.findByUsuarioEEscritorio.mockResolvedValue(null);

    await expect(getTenantContext()).rejects.toThrow(AcessoNegadoError);
  });

  it("devolve o contexto com o role do banco", async () => {
    mockedLerSessao.mockResolvedValue({ sub: "user-1", escritorioId: "esc-1" });
    mockedMembroRepo.findByUsuarioEEscritorio.mockResolvedValue({ escritorioId: "esc-1", role: "admin" } as never);

    await expect(getTenantContext()).resolves.toEqual({ usuarioId: "user-1", escritorioId: "esc-1", role: "admin" });
    expect(mockedMembroRepo.findByUsuarioEEscritorio).toHaveBeenCalledWith("user-1", "esc-1");
  });
});
