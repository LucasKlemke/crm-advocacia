import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste } from "../../test/utils";
import { WebhooksModule } from "./webhooks.module";
import { NaoAutenticadoError } from "@dominio/lib/auth/resolver-tenant";

describe("POST /api/webhooks/uazapi", () => {
  let app: INestApplication;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    // Sem sessão: se o controller tivesse TenantGuard, todas as respostas seriam 401.
    app = await criarAppDeTeste({ imports: [WebhooksModule], ctx: new NaoAutenticadoError() });
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
