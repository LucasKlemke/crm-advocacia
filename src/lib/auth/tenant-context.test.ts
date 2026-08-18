import { getTenantContext, NaoAutenticadoError } from "./tenant-context";
import { auth } from "@/lib/auth/config";

jest.mock("@/lib/auth/config", () => ({
  auth: jest.fn(),
}));

const mockedAuth = auth as jest.Mock;

describe("getTenantContext", () => {
  afterEach(() => jest.clearAllMocks());

  it("lança NaoAutenticadoError quando não há sessão (RN01)", async () => {
    mockedAuth.mockResolvedValue(null);

    await expect(getTenantContext()).rejects.toThrow(NaoAutenticadoError);
  });

  it("lança NaoAutenticadoError quando a sessão não tem escritorioId", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } });

    await expect(getTenantContext()).rejects.toThrow(NaoAutenticadoError);
  });

  it("retorna usuarioId, escritorioId e role a partir da sessão (RN19)", async () => {
    mockedAuth.mockResolvedValue({
      user: { id: "user-1", escritorioId: "esc-1", role: "titular" },
    });

    const contexto = await getTenantContext();

    expect(contexto).toEqual({
      usuarioId: "user-1",
      escritorioId: "esc-1",
      role: "titular",
    });
  });
});
