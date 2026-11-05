import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste } from "../../test/utils";
import { setCookieDaSessao, tokenDoSetCookie, usarSegredoDeTeste } from "../../test/sessao";
import { SessaoModule } from "./sessao.module";
import { ESCRITORIO_SERVICE } from "./tokens";
import { NaoAutenticadoError } from "@/lib/auth/resolver-tenant";
import { verificarSessao } from "@/lib/auth/sessao-jwt";

const escritorioService = { criarEscritorio: jest.fn() };
let app: INestApplication;

async function subir(usuarioId: string | Error = "user-1") {
  app = await criarAppDeTeste({
    imports: [SessaoModule],
    usuarioId,
    overrides: [[ESCRITORIO_SERVICE, escritorioService]],
  });
  return app.getHttpServer();
}

usarSegredoDeTeste();

afterEach(async () => {
  jest.clearAllMocks();
  await app?.close();
});

describe("POST /api/escritorios", () => {
  it("cria o escritório com o usuário como owner e o torna o ativo da sessão", async () => {
    escritorioService.criarEscritorio.mockResolvedValue({
      escritorio: { id: "esc-novo", nome: "Escritório Teste" },
      membro: { id: "m-1", role: "owner" },
    });

    const res = await request(await subir())
      .post("/api/escritorios")
      .send({ nome: "Escritório Teste" })
      .expect(201, { escritorio: { id: "esc-novo", nome: "Escritório Teste" }, role: "owner" });

    expect(escritorioService.criarEscritorio).toHaveBeenCalledWith("user-1", { nome: "Escritório Teste" });
    await expect(verificarSessao(tokenDoSetCookie(setCookieDaSessao(res)))).resolves.toEqual({
      sub: "user-1",
      escritorioId: "esc-novo",
    });
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError()))
      .post("/api/escritorios")
      .send({ nome: "Escritório Teste" })
      .expect(401);
    expect(escritorioService.criarEscritorio).not.toHaveBeenCalled();
  });

  it("responde 400 para nome vazio", async () => {
    const res = await request(await subir()).post("/api/escritorios").send({ nome: "  " }).expect(400);

    expect(res.body.detalhes.nome).toEqual(["Informe o nome do escritório"]);
  });

  it("responde 500 genérico e não regrava o cookie quando a criação falha", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    escritorioService.criarEscritorio.mockRejectedValue(new Error("db fora"));

    const res = await request(await subir())
      .post("/api/escritorios")
      .send({ nome: "Escritório Teste" })
      .expect(500, { error: "Não foi possível concluir a operação." });

    expect(setCookieDaSessao(res)).toBeUndefined();
  });
});
