import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste } from "../../test/utils";
import { setCookieDaSessao, tokenDoSetCookie, usarSegredoDeTeste } from "../../test/sessao";
import { SessaoModule } from "./sessao.module";
import { MEMBRO_SERVICE } from "./tokens";
import { PermissaoNegadaError } from "@dominio/services/membro.service";
import { NaoAutenticadoError } from "@dominio/lib/auth/resolver-tenant";
import { verificarSessao } from "@dominio/lib/auth/sessao-jwt";

const membroService = { trocarEscritorioAtivo: jest.fn() };
let app: INestApplication;

async function subir(usuarioId: string | Error = "user-1") {
  app = await criarAppDeTeste({ imports: [SessaoModule], usuarioId, overrides: [[MEMBRO_SERVICE, membroService]] });
  return app.getHttpServer();
}

usarSegredoDeTeste();

afterEach(async () => {
  jest.clearAllMocks();
  await app?.close();
});

describe("POST /api/sessao/escritorio-ativo", () => {
  it("troca o escritório ativo validando a membership e regrava o cookie", async () => {
    membroService.trocarEscritorioAtivo.mockResolvedValue({ escritorioId: "esc-2", role: "admin" });

    const res = await request(await subir())
      .post("/api/sessao/escritorio-ativo")
      .send({ escritorioId: "esc-2" })
      .expect(200, { escritorioId: "esc-2", role: "admin" });

    expect(membroService.trocarEscritorioAtivo).toHaveBeenCalledWith("user-1", "esc-2");
    await expect(verificarSessao(tokenDoSetCookie(setCookieDaSessao(res)))).resolves.toEqual({
      sub: "user-1",
      escritorioId: "esc-2",
    });
  });

  it("responde 401 sem sessão e não chama o service", async () => {
    await request(await subir(new NaoAutenticadoError()))
      .post("/api/sessao/escritorio-ativo")
      .send({ escritorioId: "esc-2" })
      .expect(401, { error: "Sessão inválida ou expirada." });
    expect(membroService.trocarEscritorioAtivo).not.toHaveBeenCalled();
  });

  it("responde 400 para payload inválido", async () => {
    const res = await request(await subir()).post("/api/sessao/escritorio-ativo").send({}).expect(400);

    expect(res.body).toEqual({ error: "Dados inválidos", detalhes: { escritorioId: expect.any(Array) } });
    expect(membroService.trocarEscritorioAtivo).not.toHaveBeenCalled();
  });

  it("responde 403 e não regrava o cookie quando o usuário não é membro (RN19)", async () => {
    membroService.trocarEscritorioAtivo.mockRejectedValue(new PermissaoNegadaError());

    const res = await request(await subir())
      .post("/api/sessao/escritorio-ativo")
      .send({ escritorioId: "esc-de-outro-tenant" })
      .expect(403, { error: "Você não tem permissão para executar esta ação." });

    expect(setCookieDaSessao(res)).toBeUndefined();
  });

  it("responde 500 genérico para erro inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    membroService.trocarEscritorioAtivo.mockRejectedValue(new Error("db fora"));

    await request(await subir())
      .post("/api/sessao/escritorio-ativo")
      .send({ escritorioId: "esc-2" })
      .expect(500, { error: "Não foi possível concluir a operação." });
  });
});
