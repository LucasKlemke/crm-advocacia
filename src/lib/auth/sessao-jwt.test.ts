/**
 * @jest-environment node
 */
import { SignJWT } from "jose";
import {
  NOME_COOKIE_SESSAO_CRM,
  DURACAO_SESSAO_SEGUNDOS,
  assinarSessao,
  verificarSessao,
  opcoesCookieSessao,
  extrairTokenDoCookie,
} from "./sessao-jwt";

const SEGREDO = "segredo-de-teste-com-pelo-menos-32-caracteres";
const ambienteOriginal = { ...process.env };

function chave(segredo = SEGREDO) {
  return new TextEncoder().encode(segredo);
}

describe("sessao-jwt", () => {
  beforeEach(() => {
    process.env = { ...ambienteOriginal, AUTH_SECRET: SEGREDO };
    delete process.env.NEXTAUTH_SECRET;
  });

  afterAll(() => {
    process.env = ambienteOriginal;
  });

  describe("assinarSessao + verificarSessao", () => {
    it("faz ida e volta com usuário e escritório", async () => {
      const token = await assinarSessao({ sub: "user-1", escritorioId: "esc-1" });

      await expect(verificarSessao(token)).resolves.toEqual({ sub: "user-1", escritorioId: "esc-1" });
    });

    it("preserva escritorioId null (usuário ainda sem escritório — onboarding)", async () => {
      const token = await assinarSessao({ sub: "user-1", escritorioId: null });

      await expect(verificarSessao(token)).resolves.toEqual({ sub: "user-1", escritorioId: null });
    });

    it("não grava role no JWT (role sempre do banco — RN19)", async () => {
      const token = await assinarSessao({ sub: "user-1", escritorioId: "esc-1" });
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());

      expect(payload).not.toHaveProperty("role");
      expect(payload.exp - payload.iat).toBe(DURACAO_SESSAO_SEGUNDOS);
    });

    it("usa NEXTAUTH_SECRET quando AUTH_SECRET não está definido", async () => {
      delete process.env.AUTH_SECRET;
      process.env.NEXTAUTH_SECRET = SEGREDO;

      const token = await assinarSessao({ sub: "user-1", escritorioId: null });

      await expect(verificarSessao(token)).resolves.toEqual({ sub: "user-1", escritorioId: null });
    });

    it("lança quando nenhum segredo está configurado (erro de deploy, não sessão inválida)", async () => {
      delete process.env.AUTH_SECRET;

      await expect(assinarSessao({ sub: "user-1", escritorioId: null })).rejects.toThrow(
        "AUTH_SECRET não configurado."
      );
      await expect(verificarSessao("qualquer.coisa.aqui")).rejects.toThrow("AUTH_SECRET não configurado.");
    });
  });

  describe("verificarSessao rejeita", () => {
    it.each([undefined, null, ""])("token ausente (%p)", async (token) => {
      await expect(verificarSessao(token)).resolves.toBeNull();
    });

    it("token malformado", async () => {
      await expect(verificarSessao("nao-e-um-jwt")).resolves.toBeNull();
    });

    it("token assinado com outro segredo", async () => {
      const token = await new SignJWT({ escritorioId: "esc-1" })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject("user-1")
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(chave("outro-segredo-com-pelo-menos-32-caracteres"));

      await expect(verificarSessao(token)).resolves.toBeNull();
    });

    it("token expirado", async () => {
      const agora = Math.floor(Date.now() / 1000);
      const token = await new SignJWT({ escritorioId: "esc-1" })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject("user-1")
        .setIssuedAt(agora - 120)
        .setExpirationTime(agora - 60)
        .sign(chave());

      await expect(verificarSessao(token)).resolves.toBeNull();
    });

    it("token sem sub", async () => {
      const token = await new SignJWT({ escritorioId: "esc-1" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(chave());

      await expect(verificarSessao(token)).resolves.toBeNull();
    });

    it("token com payload adulterado (assinatura não confere)", async () => {
      const token = await assinarSessao({ sub: "user-1", escritorioId: "esc-1" });
      const [cabecalho, , assinatura] = token.split(".");
      const adulterado = Buffer.from(JSON.stringify({ sub: "user-1", escritorioId: "esc-de-outro-tenant" })).toString(
        "base64url"
      );

      await expect(verificarSessao(`${cabecalho}.${adulterado}.${assinatura}`)).resolves.toBeNull();
    });

    it("escritorioId que não é string vira null", async () => {
      const token = await new SignJWT({ escritorioId: 42 })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject("user-1")
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(chave());

      await expect(verificarSessao(token)).resolves.toEqual({ sub: "user-1", escritorioId: null });
    });
  });

  describe("opcoesCookieSessao", () => {
    it("httpOnly, lax, path / e 30 dias em segundos", () => {
      process.env = { ...process.env, NODE_ENV: "development" };

      expect(opcoesCookieSessao()).toEqual({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
        maxAge: 30 * 24 * 60 * 60,
      });
    });

    it("secure em produção", () => {
      process.env = { ...process.env, NODE_ENV: "production" };

      expect(opcoesCookieSessao().secure).toBe(true);
    });
  });

  describe("extrairTokenDoCookie", () => {
    it("acha o crm_sessao entre outros cookies", () => {
      expect(extrairTokenDoCookie(`tema=escuro; ${NOME_COOKIE_SESSAO_CRM}=abc.def.ghi; outro=1`)).toBe("abc.def.ghi");
    });

    it("ignora o cookie legado do NextAuth", () => {
      expect(extrairTokenDoCookie("authjs.session-token=xyz")).toBeNull();
    });

    it.each([undefined, null, "", `${NOME_COOKIE_SESSAO_CRM}=`])("devolve null para %p", (cabecalho) => {
      expect(extrairTokenDoCookie(cabecalho)).toBeNull();
    });
  });
});
