import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { EscritoriosModule } from "./escritorios.module";
import { ESCRITORIO_SERVICE } from "./tokens";
import { EscritorioNaoEncontradoError, PermissaoNegadaError } from "@dominio/services/escritorio.service";
import {
  AcessoNegadoError,
  NaoAutenticadoError,
  SemEscritorioAtivoError,
} from "@dominio/lib/auth/resolver-tenant";

const service = { obterEscritorioAtivo: jest.fn(), atualizarEscritorio: jest.fn() };

let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({ imports: [EscritoriosModule], ctx, overrides: [[ESCRITORIO_SERVICE, service]] });
  return app.getHttpServer();
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  jest.clearAllMocks();
  await app?.close();
});

describe("GET /api/escritorios/atual", () => {
  it.each([
    [new NaoAutenticadoError(), 401],
    [new SemEscritorioAtivoError(), 409],
    [new AcessoNegadoError(), 403],
  ])("responde o erro de tenant %p com %i", async (erro, status) => {
    await request(await subir(erro)).get("/api/escritorios/atual").expect(status, { error: erro.message });
    expect(service.obterEscritorioAtivo).not.toHaveBeenCalled();
  });

  it("devolve o escritório ativo da sessão", async () => {
    service.obterEscritorioAtivo.mockResolvedValue({ id: "esc-1", nome: "Escritório" });

    await request(await subir())
      .get("/api/escritorios/atual")
      .expect(200, { escritorio: { id: "esc-1", nome: "Escritório" } });
    expect(service.obterEscritorioAtivo).toHaveBeenCalledWith(CTX_OWNER);
  });

  it("responde 404 quando o escritório não existe mais", async () => {
    const erro = new EscritorioNaoEncontradoError();
    service.obterEscritorioAtivo.mockRejectedValue(erro);

    await request(await subir()).get("/api/escritorios/atual").expect(404, { error: erro.message });
  });

  it("responde 500 genérico para erro inesperado", async () => {
    service.obterEscritorioAtivo.mockRejectedValue(new Error("boom"));

    await request(await subir())
      .get("/api/escritorios/atual")
      .expect(500, { error: "Não foi possível concluir a operação." });
  });
});

describe("PATCH /api/escritorios/atual", () => {
  it("atualiza parcialmente e devolve o escritório", async () => {
    service.atualizarEscritorio.mockResolvedValue({ id: "esc-1", nome: "Novo" });

    await request(await subir())
      .patch("/api/escritorios/atual")
      .send({ nome: "  Novo  " })
      .expect(200, { escritorio: { id: "esc-1", nome: "Novo" } });
    // O schema faz trim: o service recebe o valor normalizado.
    expect(service.atualizarEscritorio).toHaveBeenCalledWith(CTX_OWNER, { nome: "Novo" });
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError()))
      .patch("/api/escritorios/atual")
      .send({ nome: "Novo" })
      .expect(401);
  });

  it("responde 400 para JSON malformado", async () => {
    await request(await subir())
      .patch("/api/escritorios/atual")
      .set("content-type", "application/json")
      .send("{x")
      .expect(400, { error: "Dados inválidos" });
  });

  it("responde 400 com detalhes para nome vazio", async () => {
    const res = await request(await subir()).patch("/api/escritorios/atual").send({ nome: "" }).expect(400);

    expect(res.body.detalhes.nome).toEqual(["Informe o nome do escritório"]);
    expect(service.atualizarEscritorio).not.toHaveBeenCalled();
  });

  it("responde 403 quando o service bloqueia (role padrao)", async () => {
    const erro = new PermissaoNegadaError();
    service.atualizarEscritorio.mockRejectedValue(erro);

    await request(await subir()).patch("/api/escritorios/atual").send({ nome: "Novo" }).expect(403, { error: erro.message });
  });

  it("responde 500 genérico para erro inesperado", async () => {
    service.atualizarEscritorio.mockRejectedValue(new Error("boom"));

    await request(await subir()).patch("/api/escritorios/atual").send({ nome: "Novo" }).expect(500);
  });
});
