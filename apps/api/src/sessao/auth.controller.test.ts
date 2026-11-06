import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste } from "../../test/utils";
import { cookieDeSessao, setCookieDaSessao, tokenDoSetCookie, usarSegredoDeTeste } from "../../test/sessao";
import { SessaoModule } from "./sessao.module";
import { AUTORIZAR_CREDENCIAIS, MEMBRO_SERVICE, USUARIO_SERVICE } from "./tokens";
import { verificarSessao } from "@dominio/lib/auth/sessao-jwt";

const autorizar = jest.fn();
const usuarioService = { obterPerfil: jest.fn() };
const membroService = { obterMembroDoUsuario: jest.fn() };

const USUARIO = { id: "user-1", nome: "Fulana", email: "fulana@teste.com", ativo: true };

let app: INestApplication;

async function subir() {
  app = await criarAppDeTeste({
    imports: [SessaoModule],
    overrides: [
      [AUTORIZAR_CREDENCIAIS, autorizar],
      [USUARIO_SERVICE, usuarioService],
      [MEMBRO_SERVICE, membroService],
    ],
  });
  return app.getHttpServer();
}

usarSegredoDeTeste();

afterEach(async () => {
  jest.clearAllMocks();
  await app?.close();
});

describe("POST /api/auth/login", () => {
  it("autentica, grava crm_sessao com o escritório inicial e devolve o usuário", async () => {
    autorizar.mockResolvedValue({
      id: "user-1",
      name: "Fulana",
      email: "fulana@teste.com",
      escritorioId: "esc-1",
      role: "owner",
    });

    const res = await request(await subir())
      .post("/api/auth/login")
      .send({ email: "fulana@teste.com", senha: "senha-forte-123" })
      .expect(200, {
        usuario: { id: "user-1", nome: "Fulana", email: "fulana@teste.com" },
        escritorioId: "esc-1",
      });

    expect(autorizar).toHaveBeenCalledWith("fulana@teste.com", "senha-forte-123");
    const setCookie = setCookieDaSessao(res);
    expect(setCookie).toContain("HttpOnly");
    // Sem role no JWT (RN19): o payload só tem sub + escritorioId.
    await expect(verificarSessao(tokenDoSetCookie(setCookie))).resolves.toEqual({
      sub: "user-1",
      escritorioId: "esc-1",
    });
  });

  it("aceita usuário sem nenhum escritório (escritorioId null → onboarding)", async () => {
    autorizar.mockResolvedValue({ id: "user-1", name: "F", email: "f@t.com", escritorioId: null, role: null });

    const res = await request(await subir())
      .post("/api/auth/login")
      .send({ email: "f@t.com", senha: "x" })
      .expect(200);

    expect(res.body.escritorioId).toBeNull();
    await expect(verificarSessao(tokenDoSetCookie(setCookieDaSessao(res)))).resolves.toEqual({
      sub: "user-1",
      escritorioId: null,
    });
  });

  it("responde 401 e não grava cookie para credenciais inválidas ou usuário inativo (RN02a)", async () => {
    autorizar.mockResolvedValue(null);

    const res = await request(await subir())
      .post("/api/auth/login")
      .send({ email: "fulana@teste.com", senha: "errada" })
      .expect(401, { error: "E-mail ou senha inválidos." });

    expect(setCookieDaSessao(res)).toBeUndefined();
  });

  it("recusa corpo urlencoded (CSRF por form cross-site) sem chamar a autenticação", async () => {
    const res = await request(await subir())
      .post("/api/auth/login")
      .type("form")
      .send("email=a@b.com&senha=x");

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(autorizar).not.toHaveBeenCalled();
    expect(setCookieDaSessao(res)).toBeUndefined();
  });

  it("responde 400 sem chamar a autenticação quando falta senha", async () => {
    const res = await request(await subir()).post("/api/auth/login").send({ email: "fulana@teste.com" }).expect(400);

    expect(res.body.error).toBe("Dados inválidos");
    expect(autorizar).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/logout", () => {
  it("limpa o cookie e responde { ok: true }, mesmo sem sessão", async () => {
    const res = await request(await subir()).post("/api/auth/logout").expect(200, { ok: true });

    const setCookie = setCookieDaSessao(res);
    expect(setCookie).toMatch(/^crm_sessao=;.*Expires=Thu, 01 Jan 1970/);
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
  });
});

describe("GET /api/auth/sessao", () => {
  it("devolve usuário, escritório ativo e role do banco", async () => {
    usuarioService.obterPerfil.mockResolvedValue(USUARIO);
    membroService.obterMembroDoUsuario.mockResolvedValue({ escritorioId: "esc-1", role: "admin" });

    await request(await subir())
      .get("/api/auth/sessao")
      .set("Cookie", await cookieDeSessao({ sub: "user-1", escritorioId: "esc-1" }))
      .expect(200, {
        usuario: { id: "user-1", nome: "Fulana", email: "fulana@teste.com" },
        escritorioId: "esc-1",
        role: "admin",
      });
    expect(membroService.obterMembroDoUsuario).toHaveBeenCalledWith("user-1", "esc-1");
  });

  it("não devolve escritório do qual o usuário deixou de ser membro (RN19)", async () => {
    usuarioService.obterPerfil.mockResolvedValue(USUARIO);
    membroService.obterMembroDoUsuario.mockResolvedValue(null);

    const res = await request(await subir())
      .get("/api/auth/sessao")
      .set("Cookie", await cookieDeSessao({ sub: "user-1", escritorioId: "esc-removido" }))
      .expect(200);

    expect(res.body).toMatchObject({ escritorioId: null, role: null });
  });

  it("devolve escritorioId/role null sem consultar membership quando a sessão não tem escritório", async () => {
    usuarioService.obterPerfil.mockResolvedValue(USUARIO);

    const res = await request(await subir())
      .get("/api/auth/sessao")
      .set("Cookie", await cookieDeSessao({ sub: "user-1", escritorioId: null }))
      .expect(200);

    expect(res.body).toMatchObject({ escritorioId: null, role: null });
    expect(membroService.obterMembroDoUsuario).not.toHaveBeenCalled();
  });

  it("responde 401 sem cookie", async () => {
    await request(await subir())
      .get("/api/auth/sessao")
      .expect(401, { error: "Sessão inválida ou expirada." });
    expect(usuarioService.obterPerfil).not.toHaveBeenCalled();
  });

  it("responde 401 com o cookie legado do NextAuth (sessões antigas invalidadas)", async () => {
    await request(await subir())
      .get("/api/auth/sessao")
      .set("Cookie", "authjs.session-token=qualquer")
      .expect(401);
  });

  it("responde 401 com crm_sessao adulterado (assinatura inválida)", async () => {
    const valido = await cookieDeSessao({ sub: "user-1", escritorioId: "esc-1" });
    const adulterado = `${valido.slice(0, -4)}AAAA`;

    await request(await subir())
      .get("/api/auth/sessao")
      .set("Cookie", adulterado)
      .expect(401, { error: "Sessão inválida ou expirada." });
    expect(usuarioService.obterPerfil).not.toHaveBeenCalled();
  });

  it("responde 401 quando o usuário foi desativado depois do login", async () => {
    usuarioService.obterPerfil.mockResolvedValue({ ...USUARIO, ativo: false });

    await request(await subir())
      .get("/api/auth/sessao")
      .set("Cookie", await cookieDeSessao({ sub: "user-1", escritorioId: "esc-1" }))
      .expect(401);
  });
});
