import {
  resolverTenantContext,
  NaoAutenticadoError,
  SemEscritorioAtivoError,
  AcessoNegadoError,
} from "./resolver-tenant";
import { membroRepository } from "@/repositories/membro.repository";

jest.mock("@/repositories/membro.repository");

const repo = membroRepository as jest.Mocked<typeof membroRepository>;

describe("resolverTenantContext", () => {
  afterEach(() => jest.clearAllMocks());

  it("lança NaoAutenticadoError sem sessão (RN01)", async () => {
    await expect(resolverTenantContext(null)).rejects.toThrow(NaoAutenticadoError);
  });

  it("lança NaoAutenticadoError quando a sessão não tem usuário", async () => {
    await expect(resolverTenantContext({ usuarioId: null })).rejects.toThrow(NaoAutenticadoError);
  });

  it("lança SemEscritorioAtivoError sem escritorioId", async () => {
    await expect(
      resolverTenantContext({ usuarioId: "user-1", escritorioId: null })
    ).rejects.toThrow(SemEscritorioAtivoError);
  });

  it("lança AcessoNegadoError quando o usuário não é membro (RN19)", async () => {
    repo.findByUsuarioEEscritorio.mockResolvedValue(null);

    await expect(
      resolverTenantContext({ usuarioId: "user-1", escritorioId: "esc-1" })
    ).rejects.toThrow(AcessoNegadoError);
    expect(repo.findByUsuarioEEscritorio).toHaveBeenCalledWith("user-1", "esc-1");
  });

  it("devolve o contexto com o role vindo do banco", async () => {
    repo.findByUsuarioEEscritorio.mockResolvedValue({ escritorioId: "esc-1", role: "padrao" } as never);

    await expect(
      resolverTenantContext({ usuarioId: "user-1", escritorioId: "esc-1" })
    ).resolves.toEqual({ usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" });
  });
});
