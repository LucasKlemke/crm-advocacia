import {
  getTenantContext,
  NaoAutenticadoError,
  SemEscritorioAtivoError,
  AcessoNegadoError,
} from "./tenant-context";
import { auth } from "@/lib/auth/config";
import { membroRepository } from "@/repositories/membro.repository";

jest.mock("@/lib/auth/config", () => ({
  auth: jest.fn(),
}));
jest.mock("@/repositories/membro.repository");

const mockedAuth = auth as jest.Mock;
const mockedMembroRepo = membroRepository as jest.Mocked<typeof membroRepository>;

describe("getTenantContext", () => {
  afterEach(() => jest.clearAllMocks());

  it("lança NaoAutenticadoError quando não há sessão (RN01)", async () => {
    mockedAuth.mockResolvedValue(null);

    await expect(getTenantContext()).rejects.toThrow(NaoAutenticadoError);
  });

  it("lança NaoAutenticadoError quando a sessão não tem usuário", async () => {
    mockedAuth.mockResolvedValue({ user: null });

    await expect(getTenantContext()).rejects.toThrow(NaoAutenticadoError);
  });

  it("lança SemEscritorioAtivoError quando a sessão não tem escritorioId", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1", escritorioId: null } });

    await expect(getTenantContext()).rejects.toThrow(SemEscritorioAtivoError);
  });

  it("lança AcessoNegadoError quando o usuário não é membro do escritório da sessão (RN19)", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1", escritorioId: "esc-1" } });
    mockedMembroRepo.findByUsuarioEEscritorio.mockResolvedValue(null);

    await expect(getTenantContext()).rejects.toThrow(AcessoNegadoError);
  });

  it("retorna usuarioId, escritorioId e role a partir do banco (RN19)", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1", escritorioId: "esc-1" } });
    mockedMembroRepo.findByUsuarioEEscritorio.mockResolvedValue({
      escritorioId: "esc-1",
      role: "owner",
    } as never);

    const contexto = await getTenantContext();

    expect(contexto).toEqual({
      usuarioId: "user-1",
      escritorioId: "esc-1",
      role: "owner",
    });
  });

  it("ignora um role divergente presente no JWT — role sempre vem do banco", async () => {
    mockedAuth.mockResolvedValue({
      user: { id: "user-1", escritorioId: "esc-1", role: "owner" },
    });
    mockedMembroRepo.findByUsuarioEEscritorio.mockResolvedValue({
      escritorioId: "esc-1",
      role: "padrao",
    } as never);

    const contexto = await getTenantContext();

    expect(contexto.role).toBe("padrao");
  });
});
