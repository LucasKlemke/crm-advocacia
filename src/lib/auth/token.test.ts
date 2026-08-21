/**
 * @jest-environment node
 */
import { getToken } from "next-auth/jwt";
import { deveUsarCookieSeguro, lerTokenDaSessao, lerUsuarioIdDaSessao } from "./token";

jest.mock("next-auth/jwt", () => ({
  getToken: jest.fn(),
}));

const mockedGetToken = getToken as jest.Mock;

function requestComCookie(cookie?: string) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  return { headers };
}

const envOriginal = { ...process.env };

describe("deveUsarCookieSeguro", () => {
  afterEach(() => {
    process.env = { ...envOriginal };
  });

  it("detecta o cookie com prefixo __Secure- enviado pelo browser", () => {
    expect(
      deveUsarCookieSeguro(requestComCookie("__Secure-authjs.session-token=abc"))
    ).toBe(true);
  });

  it("detecta o cookie __Secure- chunkado (sufixo .0/.1)", () => {
    expect(
      deveUsarCookieSeguro(
        requestComCookie("outro=1; __Secure-authjs.session-token.0=abc; __Secure-authjs.session-token.1=def")
      )
    ).toBe(true);
  });

  it("usa o cookie sem prefixo quando é ele que chega (dev em http)", () => {
    expect(deveUsarCookieSeguro(requestComCookie("authjs.session-token=abc"))).toBe(false);
  });

  it("não confunde o cookie seguro com o simples pelo sufixo do nome", () => {
    // "authjs.session-token" é substring de "__Secure-authjs.session-token": uma checagem
    // ingênua por substring classificaria produção como http.
    const request = requestComCookie("__Secure-authjs.session-token=abc");
    expect(deveUsarCookieSeguro(request)).toBe(true);
  });

  it("cai para o protocolo da AUTH_URL quando não há cookie de sessão", () => {
    process.env.AUTH_URL = "https://crm.example.com";
    expect(deveUsarCookieSeguro(requestComCookie("outro=1"))).toBe(true);

    process.env.AUTH_URL = "http://localhost:3000";
    expect(deveUsarCookieSeguro(requestComCookie())).toBe(false);
  });

  it("cai para NEXTAUTH_URL quando AUTH_URL não está definida", () => {
    delete process.env.AUTH_URL;
    process.env.NEXTAUTH_URL = "https://crm.example.com";
    expect(deveUsarCookieSeguro(requestComCookie())).toBe(true);
  });

  it("cai para NODE_ENV=production quando não há cookie nem URL configurada", () => {
    delete process.env.AUTH_URL;
    delete process.env.NEXTAUTH_URL;

    process.env = { ...process.env, NODE_ENV: "production" } as NodeJS.ProcessEnv;
    expect(deveUsarCookieSeguro(requestComCookie())).toBe(true);

    process.env = { ...process.env, NODE_ENV: "development" } as NodeJS.ProcessEnv;
    expect(deveUsarCookieSeguro(requestComCookie())).toBe(false);
  });

  it("funciona sem request (nenhum header disponível)", () => {
    delete process.env.AUTH_URL;
    delete process.env.NEXTAUTH_URL;
    process.env = { ...process.env, NODE_ENV: "production" } as NodeJS.ProcessEnv;
    expect(deveUsarCookieSeguro()).toBe(true);
  });
});

describe("lerTokenDaSessao", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...envOriginal };
  });

  afterAll(() => {
    process.env = { ...envOriginal };
  });

  it("passa secureCookie=true quando a request traz o cookie __Secure- (regressão do 401 em produção)", async () => {
    mockedGetToken.mockResolvedValue({ sub: "user-1" });
    process.env.NEXTAUTH_SECRET = "segredo";

    const request = requestComCookie("__Secure-authjs.session-token=abc");
    await lerTokenDaSessao(request);

    expect(mockedGetToken).toHaveBeenCalledWith({
      req: request,
      secret: "segredo",
      secureCookie: true,
    });
  });

  it("passa secureCookie=false em ambiente http", async () => {
    mockedGetToken.mockResolvedValue({ sub: "user-1" });
    process.env.NEXTAUTH_SECRET = "segredo";

    const request = requestComCookie("authjs.session-token=abc");
    await lerTokenDaSessao(request);

    expect(mockedGetToken).toHaveBeenCalledWith(
      expect.objectContaining({ secureCookie: false })
    );
  });

  it("prefere AUTH_SECRET sobre NEXTAUTH_SECRET", async () => {
    mockedGetToken.mockResolvedValue(null);
    process.env.AUTH_SECRET = "novo";
    process.env.NEXTAUTH_SECRET = "antigo";

    await lerTokenDaSessao(requestComCookie());

    expect(mockedGetToken).toHaveBeenCalledWith(
      expect.objectContaining({ secret: "novo" })
    );
  });
});

describe("lerUsuarioIdDaSessao", () => {
  beforeEach(() => jest.clearAllMocks());

  it("retorna o sub do token", async () => {
    mockedGetToken.mockResolvedValue({ sub: "user-1" });
    await expect(lerUsuarioIdDaSessao(requestComCookie())).resolves.toBe("user-1");
  });

  it("retorna null quando não há token", async () => {
    mockedGetToken.mockResolvedValue(null);
    await expect(lerUsuarioIdDaSessao(requestComCookie())).resolves.toBeNull();
  });

  it("retorna null quando o token não tem sub", async () => {
    mockedGetToken.mockResolvedValue({});
    await expect(lerUsuarioIdDaSessao(requestComCookie())).resolves.toBeNull();
  });
});
