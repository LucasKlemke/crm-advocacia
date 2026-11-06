import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste } from "../../test/utils";
import { WebhooksModule } from "./webhooks.module";
import { NaoAutenticadoError } from "@dominio/lib/auth/resolver-tenant";
import { assinarInstancia } from "@dominio/lib/auth/assinatura-webhook";
import { AGENDADOR_SINCRONIZACAO } from "../tempo-real/tokens";

const SEGREDO = "segredo-de-teste";

describe("POST /api/webhooks/uazapi", () => {
  let app: INestApplication;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    // Sem sessão: se o controller tivesse TenantGuard, todas as respostas seriam 401.
    app = await criarAppDeTeste({
      imports: [WebhooksModule],
      ctx: new NaoAutenticadoError(),
      overrides: [[AGENDADOR_SINCRONIZACAO, { agendarInstancia: jest.fn() }]],
    });
  });

  afterEach(async () => {
    logSpy.mockRestore();
    await app.close();
  });

  it("é pública: responde 200 { ok: true } e loga só tipo do evento e tamanho, nunca o payload", async () => {
    const payload = { EventType: "messages", instance: "abc123", data: { texto: "segredo", telefone: "5547999999999" } };
    const bytes = Buffer.byteLength(JSON.stringify(payload));

    await request(app.getHttpServer()).post("/api/webhooks/uazapi").send(payload).expect(200, { ok: true });

    expect(logSpy).toHaveBeenCalledWith("[webhook uazapi]", { tipo: "messages", bytes });
    const tudo = JSON.stringify(logSpy.mock.calls);
    expect(tudo).not.toContain("segredo");
    expect(tudo).not.toContain("5547999999999");
  });

  it("aceita o campo event como identificador do tipo", async () => {
    await request(app.getHttpServer()).post("/api/webhooks/uazapi").send({ event: "connection" }).expect(200);

    expect(logSpy).toHaveBeenCalledWith("[webhook uazapi]", expect.objectContaining({ tipo: "connection" }));
  });

  it("responde 200 mesmo com corpo vazio, logando tipo null e 0 bytes", async () => {
    await request(app.getHttpServer()).post("/api/webhooks/uazapi").expect(200, { ok: true });

    expect(logSpy).toHaveBeenCalledWith("[webhook uazapi]", { tipo: "null", bytes: 0 });
  });

  it("responde 200 mesmo com corpo não-JSON, sem logar o texto", async () => {
    await request(app.getHttpServer())
      .post("/api/webhooks/uazapi")
      .set("content-type", "text/plain")
      .send("isso não é json")
      .expect(200, { ok: true });

    expect(logSpy).toHaveBeenCalledWith("[webhook uazapi]", { tipo: "string", bytes: Buffer.byteLength("isso não é json") });
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain("isso não é json");
  });

  // O caso que o parser JSON global quebraria com 400 antes de chegar ao controller.
  it("responde 200 para JSON malformado com content-type application/json", async () => {
    await request(app.getHttpServer())
      .post("/api/webhooks/uazapi")
      .set("content-type", "application/json")
      .send("{oops")
      .expect(200, { ok: true });

    expect(logSpy).toHaveBeenCalledWith("[webhook uazapi]", { tipo: "string", bytes: 5 });
  });

  it("recusa corpo acima do limite de 256 KB com 413", async () => {
    await request(app.getHttpServer())
      .post("/api/webhooks/uazapi")
      .set("content-type", "application/json")
      .send("x".repeat(300 * 1024))
      .expect(413);
  });

  it("não afeta o parser JSON das outras rotas", async () => {
    // Rota inexistente fora do webhook: o JSON malformado continua virando 400.
    await request(app.getHttpServer())
      .post("/api/outra-rota")
      .set("content-type", "application/json")
      .send("{oops")
      .expect(400, { error: "Dados inválidos" });
  });
});

describe("POST /api/webhooks/uazapi/:instanciaId/:assinatura", () => {
  let app: INestApplication;
  let logSpy: jest.SpyInstance;
  let agendador: { agendarInstancia: jest.Mock };
  const segredoOriginal = process.env.UAZAPI_WEBHOOK_SECRET;

  const urlDe = (instanciaId: string, assinatura = assinarInstancia(instanciaId, SEGREDO)) =>
    `/api/webhooks/uazapi/${instanciaId}/${assinatura}`;

  beforeEach(async () => {
    process.env.UAZAPI_WEBHOOK_SECRET = SEGREDO;
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    agendador = { agendarInstancia: jest.fn() };
    app = await criarAppDeTeste({
      imports: [WebhooksModule],
      ctx: new NaoAutenticadoError(),
      overrides: [[AGENDADOR_SINCRONIZACAO, agendador]],
    });
  });

  afterEach(async () => {
    if (segredoOriginal === undefined) delete process.env.UAZAPI_WEBHOOK_SECRET;
    else process.env.UAZAPI_WEBHOOK_SECRET = segredoOriginal;
    logSpy.mockRestore();
    await app.close();
  });

  it("assinatura válida: 200 { ok: true }, agenda a instância e loga só metadados", async () => {
    const payload = { EventType: "sender", data: { telefone: "5547999999999" } };

    await request(app.getHttpServer()).post(urlDe("inst-1")).send(payload).expect(200, { ok: true });

    expect(agendador.agendarInstancia).toHaveBeenCalledTimes(1);
    expect(agendador.agendarInstancia).toHaveBeenCalledWith("inst-1");
    expect(logSpy).toHaveBeenCalledWith("[webhook uazapi]", {
      tipo: "sender",
      bytes: Buffer.byteLength(JSON.stringify(payload)),
      instanciaId: "inst-1",
    });
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain("5547999999999");
  });

  it("assinatura válida com corpo não-JSON ou JSON malformado continua 200 e agenda", async () => {
    await request(app.getHttpServer())
      .post(urlDe("inst-1"))
      .set("content-type", "text/plain")
      .send("isso não é json")
      .expect(200, { ok: true });
    await request(app.getHttpServer())
      .post(urlDe("inst-1"))
      .set("content-type", "application/json")
      .send("{oops")
      .expect(200, { ok: true });

    expect(agendador.agendarInstancia).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain("isso não é json");
  });

  it("assinatura inválida: 404 e não agenda nem loga", async () => {
    await request(app.getHttpServer()).post(urlDe("inst-1", "assinatura-falsa")).send({}).expect(404);

    expect(agendador.agendarInstancia).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("assinatura de outra instância: 404 e não agenda", async () => {
    const daOutra = assinarInstancia("inst-2", SEGREDO);

    await request(app.getHttpServer()).post(urlDe("inst-1", daOutra)).send({}).expect(404);

    expect(agendador.agendarInstancia).not.toHaveBeenCalled();
  });

  it("assinatura truncada: 404 e não agenda", async () => {
    const truncada = assinarInstancia("inst-1", SEGREDO).slice(0, -1);

    await request(app.getHttpServer()).post(urlDe("inst-1", truncada)).send({}).expect(404);

    expect(agendador.agendarInstancia).not.toHaveBeenCalled();
  });

  it("assinatura feita com outro segredo: 404 e não agenda", async () => {
    await request(app.getHttpServer())
      .post(urlDe("inst-1", assinarInstancia("inst-1", "outro-segredo")))
      .send({})
      .expect(404);

    expect(agendador.agendarInstancia).not.toHaveBeenCalled();
  });

  it("sem UAZAPI_WEBHOOK_SECRET configurado toda assinatura é inválida: 404", async () => {
    delete process.env.UAZAPI_WEBHOOK_SECRET;

    await request(app.getHttpServer()).post(urlDe("inst-1")).send({}).expect(404);
    await request(app.getHttpServer())
      .post(urlDe("inst-1", assinarInstancia("inst-1", "")))
      .send({})
      .expect(404);

    expect(agendador.agendarInstancia).not.toHaveBeenCalled();
  });

  it("o limite de 256 KB vale também no caminho assinado", async () => {
    await request(app.getHttpServer())
      .post(urlDe("inst-1"))
      .set("content-type", "application/json")
      .send("x".repeat(300 * 1024))
      .expect(413);

    expect(agendador.agendarInstancia).not.toHaveBeenCalled();
  });

  it("a rota antiga sem parâmetros continua 200 e não agenda nada", async () => {
    await request(app.getHttpServer()).post("/api/webhooks/uazapi").send({ event: "x" }).expect(200, { ok: true });

    expect(agendador.agendarInstancia).not.toHaveBeenCalled();
  });
});
