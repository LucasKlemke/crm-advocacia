import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../app.module";
import { OPCOES_APP, configurarApp } from "../criar-app";

describe("GET /api/saude", () => {
  it("responde 200 { ok: true } sem exigir sessão", async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = configurarApp(modulo.createNestApplication(OPCOES_APP));
    await app.init();

    await request(app.getHttpServer()).get("/api/saude").expect(200, { ok: true });

    await app.close();
  });
});
