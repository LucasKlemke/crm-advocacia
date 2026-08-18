// Wiring do NextAuth é excluído do coverage (ver jest.config.ts), mas o callback `jwt`
// concentra um ponto de segurança crítico: /api/auth/session é pública e o payload de
// `trigger === "update"` chega cru do client. Este teste garante que o role/escritorioId
// finais SEMPRE vêm de `resolverEscritorioAtivo` (banco), nunca do payload não confiável.
import NextAuth from "next-auth";
import { resolverEscritorioAtivo } from "@/lib/auth/escritorio-ativo";

jest.mock("next-auth", () =>
  jest.fn(() => ({
    handlers: {},
    auth: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    unstable_update: jest.fn(),
  }))
);
jest.mock("next-auth/providers/credentials", () => jest.fn((opts) => opts));
jest.mock("@/lib/auth/authorize", () => ({ authorizeCredentials: jest.fn() }));
jest.mock("@/lib/auth/escritorio-ativo");

const mockedNextAuth = NextAuth as unknown as jest.Mock;
const mockedResolver = resolverEscritorioAtivo as jest.Mock;

function getConfig() {
  jest.isolateModules(() => {
    require("./config");
  });
  return mockedNextAuth.mock.calls[mockedNextAuth.mock.calls.length - 1][0];
}

describe("config.ts — callback jwt", () => {
  afterEach(() => jest.clearAllMocks());

  it("revalida a membership no banco em trigger=update, ignorando payload cru", async () => {
    const config = getConfig();
    mockedResolver.mockResolvedValue({ escritorioId: "esc-legitimo", role: "padrao" });

    const token = { sub: "user-1", escritorioId: "esc-antigo", role: "owner" };
    const resultado = await config.callbacks.jwt({
      token,
      trigger: "update",
      // payload malicioso/stale: tenta virar owner de outro escritório sem ser membro
      session: { user: { escritorioId: "esc-atacante", role: "owner" } },
    });

    expect(mockedResolver).toHaveBeenCalledWith("user-1", "esc-atacante");
    expect(resultado.escritorioId).toBe("esc-legitimo");
    expect(resultado.role).toBe("padrao");
  });

  it("não chama resolverEscritorioAtivo fora de trigger=update com login novo", async () => {
    const config = getConfig();

    const token = {};
    const resultado = await config.callbacks.jwt({
      token,
      user: { id: "user-1", escritorioId: "esc-1", role: "owner" },
    });

    expect(mockedResolver).not.toHaveBeenCalled();
    expect(resultado.escritorioId).toBe("esc-1");
    expect(resultado.role).toBe("owner");
  });

  it("session callback propaga escritorioId/role nulos quando o token não tem escritório ativo", async () => {
    const config = getConfig();

    const session = { user: {} };
    const resultado = await config.callbacks.session({
      session,
      token: { sub: "user-1", escritorioId: null, role: null },
    });

    expect(resultado.user.id).toBe("user-1");
    expect(resultado.user.escritorioId).toBeNull();
    expect(resultado.user.role).toBeNull();
  });
});
