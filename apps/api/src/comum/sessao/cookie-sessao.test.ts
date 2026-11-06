import { Controller, Get, Post, Req, Res } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Request, Response } from "express";
import request from "supertest";
import { OPCOES_APP, configurarApp } from "../../criar-app";
import { gravarCookieSessao, lerSessaoDaRequisicao, limparCookieSessao } from "./cookie-sessao";
import { verificarSessao } from "@dominio/lib/auth/sessao-jwt";
import { cookieDeSessao, setCookieDaSessao, tokenDoSetCookie, usarSegredoDeTeste } from "../../../test/sessao";

@Controller("cookie")
class CookieController {
  @Get()
  async ler(@Req() req: Request) {
    return { sessao: await lerSessaoDaRequisicao(req) };
  }

  @Post("gravar")
  async gravar(@Res({ passthrough: true }) res: Response) {
    await gravarCookieSessao(res, { sub: "user-1", escritorioId: "esc-1" });
    return { ok: true };
  }

  @Post("limpar")
  limpar(@Res({ passthrough: true }) res: Response) {
    limparCookieSessao(res);
    return { ok: true };
  }
}

// NODE_ENV é readonly nos tipos; escrita via env tipado como dicionário.
function definirNodeEnv(valor: string | undefined): void {
  const env = process.env as Record<string, string | undefined>;
  if (valor === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = valor;
}

describe("cookie-sessao", () => {
  usarSegredoDeTeste();

  async function subir() {
    const modulo = await Test.createTestingModule({ controllers: [CookieController] }).compile();
    const app = configurarApp(modulo.createNestApplication(OPCOES_APP));
    await app.init();
    return app;
  }

  it("lê a sessão do header Cookie", async () => {
    const app = await subir();
    const cookie = await cookieDeSessao({ sub: "user-1", escritorioId: "esc-1" });

    await request(app.getHttpServer())
      .get("/api/cookie")
      .set("Cookie", `tema=escuro; ${cookie}`)
      .expect(200, { sessao: { sub: "user-1", escritorioId: "esc-1" } });
    await app.close();
  });

  it("devolve null sem cookie ou com o cookie legado do NextAuth", async () => {
    const app = await subir();

    await request(app.getHttpServer()).get("/api/cookie").expect(200, { sessao: null });
    await request(app.getHttpServer())
      .get("/api/cookie")
      .set("Cookie", "authjs.session-token=qualquer")
      .expect(200, { sessao: null });
    await app.close();
  });

  it("grava o cookie com httpOnly, SameSite=Lax, path / e Max-Age de 30 dias (em segundos)", async () => {
    const app = await subir();

    const res = await request(app.getHttpServer()).post("/api/cookie/gravar").expect(201);
    const setCookie = setCookieDaSessao(res);

    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("Max-Age=2592000");
    expect(setCookie).not.toContain("Secure");
    await expect(verificarSessao(tokenDoSetCookie(setCookie))).resolves.toEqual({
      sub: "user-1",
      escritorioId: "esc-1",
    });
    await app.close();
  });

  it("limpa o cookie com expiração no passado", async () => {
    const app = await subir();

    const res = await request(app.getHttpServer()).post("/api/cookie/limpar").expect(201);
    const setCookie = setCookieDaSessao(res);

    expect(setCookie).toMatch(/^crm_sessao=;/);
    expect(setCookie).toContain("Expires=Thu, 01 Jan 1970");
    expect(setCookie).toContain("Path=/");
    await app.close();
  });

  it("grava com Secure em produção", async () => {
    const app = await subir();
    const anterior = process.env.NODE_ENV;
    definirNodeEnv("production");
    try {
      const res = await request(app.getHttpServer()).post("/api/cookie/gravar").expect(201);
      const setCookie = setCookieDaSessao(res);
      expect(setCookie).toContain("Secure");
      expect(setCookie).toContain("HttpOnly");
      expect(setCookie).toContain("SameSite=Lax");
    } finally {
      definirNodeEnv(anterior);
    }
    await app.close();
  });

  it("limpa o cookie com os mesmos atributos da gravação (Secure em produção)", async () => {
    const app = await subir();
    const anterior = process.env.NODE_ENV;
    definirNodeEnv("production");
    try {
      const res = await request(app.getHttpServer()).post("/api/cookie/limpar").expect(201);
      const setCookie = setCookieDaSessao(res);
      expect(setCookie).toContain("Secure");
      expect(setCookie).toContain("HttpOnly");
      expect(setCookie).toContain("SameSite=Lax");
    } finally {
      definirNodeEnv(anterior);
    }
    await app.close();
  });

  it("devolve null para cookie com token adulterado", async () => {
    const app = await subir();
    const cookie = await cookieDeSessao({ sub: "user-1", escritorioId: null });
    await request(app.getHttpServer())
      .get("/api/cookie")
      .set("Cookie", cookie + "x")
      .expect(200, { sessao: null });
    await app.close();
  });
});
