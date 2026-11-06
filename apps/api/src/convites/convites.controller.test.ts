import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { ConvitesModule } from "./convites.module";
import { CONVITE_SERVICE } from "./tokens";
import {
  ConviteJaExisteError,
  ConviteNaoEncontradoError,
  JaEhMembroError,
  PermissaoNegadaError,
} from "@dominio/services/convite.service";
import {
  AcessoNegadoError,
  NaoAutenticadoError,
  SemEscritorioAtivoError,
} from "@dominio/lib/auth/resolver-tenant";

const service = { listarPendentes: jest.fn(), convidar: jest.fn(), cancelar: jest.fn() };
const corpoValido = { email: "novo@teste.com", role: "padrao" };

let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({ imports: [ConvitesModule], ctx, overrides: [[CONVITE_SERVICE, service]] });
  return app.getHttpServer();
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  jest.clearAllMocks();
  await app?.close();
});

describe("GET /api/convites", () => {
  it("lista os convites pendentes", async () => {
    service.listarPendentes.mockResolvedValue([{ id: "convite-1" }]);

    await request(await subir()).get("/api/convites").expect(200, { convites: [{ id: "convite-1" }] });
    expect(service.listarPendentes).toHaveBeenCalledWith(CTX_OWNER);
  });

  it.each([
    [new NaoAutenticadoError(), 401],
    [new SemEscritorioAtivoError(), 409],
    [new AcessoNegadoError(), 403],
  ])("responde o erro de tenant %p com %i", async (erro, status) => {
    await request(await subir(erro)).get("/api/convites").expect(status);
  });

  it("responde 403 quando o service bloqueia (padrao)", async () => {
    const erro = new PermissaoNegadaError();
    service.listarPendentes.mockRejectedValue(erro);

    await request(await subir()).get("/api/convites").expect(403, { error: erro.message });
  });

  it("responde 500 genérico para erro inesperado", async () => {
    service.listarPendentes.mockRejectedValue(new Error("boom"));

    await request(await subir()).get("/api/convites").expect(500);
  });
});

describe("POST /api/convites", () => {
  it("responde 201 com o resultado do service como corpo", async () => {
    service.convidar.mockResolvedValue({ tipo: "convite", convite: { id: "convite-1" } });

    await request(await subir())
      .post("/api/convites")
      .send(corpoValido)
      .expect(201, { tipo: "convite", convite: { id: "convite-1" } });
    expect(service.convidar).toHaveBeenCalledWith(CTX_OWNER, corpoValido);
  });

  it("responde 400 para JSON malformado sem chamar o service", async () => {
    await request(await subir())
      .post("/api/convites")
      .set("content-type", "application/json")
      .send("{x")
      .expect(400);
    expect(service.convidar).not.toHaveBeenCalled();
  });

  it("responde 400 com detalhes para e-mail inválido", async () => {
    const res = await request(await subir()).post("/api/convites").send({ email: "invalido" }).expect(400);

    expect(res.body.detalhes.email).toEqual(["E-mail inválido"]);
    expect(service.convidar).not.toHaveBeenCalled();
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).post("/api/convites").send(corpoValido).expect(401);
  });

  it.each([
    [new PermissaoNegadaError(), 403],
    [new ConviteJaExisteError(), 409],
    [new JaEhMembroError(), 409],
  ])("mapeia %p para %i", async (erro, status) => {
    service.convidar.mockRejectedValue(erro);

    await request(await subir()).post("/api/convites").send(corpoValido).expect(status, { error: erro.message });
  });

  it("responde 500 genérico para erro inesperado", async () => {
    service.convidar.mockRejectedValue(new Error("boom"));

    await request(await subir()).post("/api/convites").send(corpoValido).expect(500);
  });
});

describe("DELETE /api/convites/:id", () => {
  it("cancela e responde { ok: true }", async () => {
    service.cancelar.mockResolvedValue(undefined);

    await request(await subir()).delete("/api/convites/convite-1").expect(200, { ok: true });
    expect(service.cancelar).toHaveBeenCalledWith(CTX_OWNER, "convite-1");
  });

  it.each([
    [new NaoAutenticadoError(), 401],
    [new SemEscritorioAtivoError(), 409],
    [new AcessoNegadoError(), 403],
  ])("responde o erro de tenant %p com %i", async (erro, status) => {
    await request(await subir(erro)).delete("/api/convites/convite-1").expect(status);
  });

  it.each([
    [new ConviteNaoEncontradoError(), 404],
    [new PermissaoNegadaError(), 403],
  ])("mapeia %p para %i", async (erro, status) => {
    service.cancelar.mockRejectedValue(erro);

    await request(await subir()).delete("/api/convites/convite-1").expect(status, { error: erro.message });
  });

  it("responde 500 genérico para erro inesperado", async () => {
    service.cancelar.mockRejectedValue(new Error("boom"));

    await request(await subir()).delete("/api/convites/convite-1").expect(500);
  });
});
