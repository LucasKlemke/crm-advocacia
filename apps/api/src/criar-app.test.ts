import { Body, Controller, HttpCode, Post, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { configurarApp } from "./criar-app";

@Controller("eco-corpo")
class EcoCorpoController {
  @Post()
  @HttpCode(200)
  eco(@Body() corpo: { linhas?: unknown[] }) {
    return { linhas: corpo.linhas?.length ?? 0 };
  }
}

describe("configurarApp — limite do corpo JSON", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ controllers: [EcoCorpoController] }).compile();
    app = configurarApp(modulo.createNestApplication());
    await app.init();
  });
  afterAll(() => app.close());

  // Campanha no teto de MAX_DESTINATARIOS (5000 linhas): ~600 KB, muito acima dos 100 KB
  // padrão do body parser do Express.
  it("aceita uma campanha com 5000 destinatários", async () => {
    const linhas = Array.from({ length: 5000 }, (_, i) => ({
      Nome: `Fulano de Tal da Silva ${i}`,
      numero: "5511999999999",
      Cidade: "Florianópolis",
      Observacao: "x".repeat(40),
    }));
    expect(JSON.stringify({ linhas }).length).toBeGreaterThan(100 * 1024);

    await request(app.getHttpServer()).post("/api/eco-corpo").send({ linhas }).expect(200, { linhas: 5000 });
  });

  it("responde 413 com mensagem amigável acima de 10 MB", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});

    await request(app.getHttpServer())
      .post("/api/eco-corpo")
      .send({ dado: "x".repeat(11 * 1024 * 1024) })
      .expect(413, { error: "O conteúdo enviado é maior que o permitido." });
  });
});
