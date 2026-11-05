import { Readable } from "node:stream";
import { Controller, Get, Res, UseFilters } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import type { Response as ExpressResponse } from "express";
import request from "supertest";
import { configurarApp } from "../criar-app";
import { ErrosHttpFilter } from "./erros-http.filter";
import { erroAoGerarZip, responderZip } from "./resposta-zip";

let falhar = false;

@Controller("zip-teste")
@UseFilters(new ErrosHttpFilter([erroAoGerarZip]))
class ZipTesteController {
  @Get()
  baixar(@Res() res: ExpressResponse) {
    if (falhar) throw new Error("S3 fora do ar em 10.0.0.1");
    responderZip(res, Readable.from([Buffer.from("PK\x03\x04")]), "documentos-caso-Ação de Cobrança.zip");
  }
}

describe("responderZip / erroAoGerarZip", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ controllers: [ZipTesteController] }).compile();
    app = configurarApp(modulo.createNestApplication());
    await app.init();
  });
  afterAll(() => app.close());
  afterEach(() => {
    falhar = false;
    jest.restoreAllMocks();
  });

  it("transmite o zip com os mesmos headers das rotas Next", async () => {
    const res = await request(app.getHttpServer()).get("/api/zip-teste").responseType("blob").expect(200);

    expect(res.headers["content-type"]).toBe("application/zip");
    expect(res.headers["content-disposition"]).toBe(
      'attachment; filename="documentos-caso-Ação de Cobrança.zip"'
    );
    expect(Buffer.from(res.body).toString("latin1")).toBe("PK\x03\x04");
  });

  it("responde 502 sem detalhe técnico quando falha antes do stream", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    falhar = true;

    await request(app.getHttpServer())
      .get("/api/zip-teste")
      .expect(502, { error: "Não foi possível gerar o arquivo zip." });
    expect(console.error).toHaveBeenCalled();
  });
});
