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

  it("é pública: loga o payload JSON e responde 200 { ok: true }", async () => {
    const payload = { event: "messages", instance: "abc123", data: { texto: "oi" } };

    await request(app.getHttpServer()).post("/api/webhooks/uazapi").send(payload).expect(200, { ok: true });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("[webhook uazapi]"),
      expect.objectContaining(payload)
    );
  });

  it("responde 200 mesmo com corpo vazio, logando null", async () => {
    await request(app.getHttpServer()).post("/api/webhooks/uazapi").expect(200, { ok: true });

    expect(logSpy).toHaveBeenCalledWith("[webhook uazapi]", null);
  });

  it("responde 200 mesmo com corpo não-JSON, logando o texto bruto", async () => {
    await request(app.getHttpServer())
      .post("/api/webhooks/uazapi")
      .set("content-type", "text/plain")
      .send("isso não é json")
      .expect(200, { ok: true });

    expect(logSpy).toHaveBeenCalledWith("[webhook uazapi]", "isso não é json");
  });

  // O caso que o parser JSON global quebraria com 400 antes de chegar ao controller.
  it("responde 200 para JSON malformado com content-type application/json", async () => {
    await request(app.getHttpServer())
      .post("/api/webhooks/uazapi")
      .set("content-type", "application/json")
      .send("{oops")
      .expect(200, { ok: true });

    expect(logSpy).toHaveBeenCalledWith("[webhook uazapi]", "{oops");
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
