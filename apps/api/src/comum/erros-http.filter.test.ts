import { BadRequestException, Controller, Get, NotFoundException, Post, Body, UseFilters } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { z } from "zod";
import { configurarApp } from "../criar-app";
import { ErrosHttpFilter } from "./erros-http.filter";
import { ValidacaoZodPipe } from "./validacao.pipe";
import { NaoAutenticadoError, SemEscritorioAtivoError, AcessoNegadoError } from "@/lib/auth/resolver-tenant";

class ErroDoModulo extends Error {}

let erroALancar: unknown;

@Controller("teste")
@UseFilters(
  new ErrosHttpFilter([
    (e) => (e instanceof ErroDoModulo ? Response.json({ error: "conflito" }, { status: 409 }) : null),
  ])
)
class TesteController {
  @Get()
  lancar() {
    throw erroALancar;
  }

  @Post()
  criar(@Body(new ValidacaoZodPipe(z.object({ nome: z.string().min(1, "Informe o nome") }))) corpo: { nome: string }) {
    return corpo;
  }
}

describe("ErrosHttpFilter", () => {
  let app: Awaited<ReturnType<typeof criar>>;
  async function criar() {
    const modulo = await Test.createTestingModule({ controllers: [TesteController] }).compile();
    const nest = configurarApp(modulo.createNestApplication());
    await nest.init();
    return nest;
  }
  beforeAll(async () => {
    app = await criar();
  });
  afterAll(() => app.close());

  it.each([
    [new NaoAutenticadoError(), 401, "Sessão inválida ou expirada."],
    [new SemEscritorioAtivoError(), 409, "Nenhum escritório ativo na sessão."],
    [new AcessoNegadoError(), 403, "Você não tem acesso a este escritório."],
  ])("mapeia erro de tenant %p para %i", async (erro, status, mensagem) => {
    erroALancar = erro;
    await request(app.getHttpServer()).get("/api/teste").expect(status, { error: mensagem });
  });

  it("usa os tradutores do módulo", async () => {
    erroALancar = new ErroDoModulo();
    await request(app.getHttpServer()).get("/api/teste").expect(409, { error: "conflito" });
  });

  it("responde 500 genérico sem detalhe técnico para erro inesperado", async () => {
    erroALancar = new Error("connection refused em 10.0.0.1");
    jest.spyOn(console, "error").mockImplementation(() => {});
    await request(app.getHttpServer())
      .get("/api/teste")
      .expect(500, { error: "Não foi possível concluir a operação." });
  });

  it("repassa HttpException com { error }", async () => {
    erroALancar = new NotFoundException("Rota não encontrada.");
    await request(app.getHttpServer()).get("/api/teste").expect(404, { error: "Rota não encontrada." });
  });

  it("trata BadRequestException (ex.: JSON malformado) como Dados inválidos", async () => {
    erroALancar = new BadRequestException("Unexpected token");
    await request(app.getHttpServer()).get("/api/teste").expect(400, { error: "Dados inválidos" });
  });

  it("mapeia corpo grande demais (body-parser) para 413", async () => {
    erroALancar = Object.assign(new Error("request entity too large"), {
      type: "entity.too.large",
      status: 413,
    });
    await request(app.getHttpServer())
      .get("/api/teste")
      .expect(413, { error: "O conteúdo enviado é maior que o permitido." });
  });

  it("devolve 400 com detalhes por campo quando o Zod reprova", async () => {
    await request(app.getHttpServer())
      .post("/api/teste")
      .send({ nome: "" })
      .expect(400, { error: "Dados inválidos", detalhes: { nome: ["Informe o nome"] } });
  });

  it("devolve 400 para JSON malformado de verdade", async () => {
    await request(app.getHttpServer())
      .post("/api/teste")
      .set("content-type", "application/json")
      .send("{oops")
      .expect(400, { error: "Dados inválidos" });
  });

  it("filtro global cobre rota inexistente", async () => {
    await request(app.getHttpServer()).get("/api/nao-existe").expect(404);
  });
});
