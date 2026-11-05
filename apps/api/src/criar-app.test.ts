import { Body, Controller, HttpCode, Post, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { OPCOES_APP, configurarApp } from "./criar-app";

@Controller("eco-corpo")
class EcoCorpoController {
  @Post()
  @HttpCode(200)
  eco(@Body() corpo: { linhas?: unknown[] } | undefined) {
    return { linhas: corpo?.linhas?.length ?? 0, corpo: corpo ?? null };
  }
}

describe("configurarApp — limite do corpo JSON", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ controllers: [EcoCorpoController] }).compile();
    app = configurarApp(modulo.createNestApplication(OPCOES_APP));
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

    const res = await request(app.getHttpServer()).post("/api/eco-corpo").send({ linhas }).expect(200);
    expect(res.body.linhas).toBe(5000);
  });

  // Defesa de CSRF: um <form> cross-site só envia urlencoded/multipart/text simples. Sem
  // parser para esses tipos, o corpo nunca vira objeto e as rotas não os aceitam.
  it("não interpreta corpo urlencoded como objeto em nenhuma rota", async () => {
    const res = await request(app.getHttpServer()).post("/api/eco-corpo").type("form").send("linhas=1&x=2");

    expect(res.body.corpo === null || Object.keys(res.body.corpo).length === 0).toBe(true);
  });

  it("responde 413 com mensagem amigável acima de 10 MB", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});

    await request(app.getHttpServer())
      .post("/api/eco-corpo")
      .send({ dado: "x".repeat(11 * 1024 * 1024) })
      .expect(413, { error: "O conteúdo enviado é maior que o permitido." });
  });
});
