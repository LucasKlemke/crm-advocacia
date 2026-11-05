import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { TiposProcessoModule } from "./tipos-processo.module";
import { TIPO_PROCESSO_SERVICE } from "./tokens";
import {
  TipoProcessoNaoEncontradoError,
  NomeTipoProcessoDuplicadoError,
  TipoProcessoComCasosError,
  PermissaoNegadaError,
} from "@/services/tipo-processo.service";
import { NaoAutenticadoError } from "@/lib/auth/resolver-tenant";

const VALIDO = { nome: "Juros abusivos", icone: "Briefcase", cor: "#6366f1" };

const service = {
  listar: jest.fn(),
  criar: jest.fn(),
  atualizar: jest.fn(),
  excluir: jest.fn(),
};

let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({
    imports: [TiposProcessoModule],
    ctx,
    overrides: [[TIPO_PROCESSO_SERVICE, service]],
  });
  return app.getHttpServer();
}

afterEach(async () => {
  jest.clearAllMocks();
  await app?.close();
});

describe("GET /api/tipos-processo", () => {
  it("lista os tipos do escritório", async () => {
    service.listar.mockResolvedValue([{ id: "tipo-processo-1" }]);

    await request(await subir())
      .get("/api/tipos-processo")
      .expect(200, { tipos: [{ id: "tipo-processo-1" }] });
    expect(service.listar).toHaveBeenCalledWith(CTX_OWNER);
  });

  it("responde 401 sem sessão e não chama o service (RN19)", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/tipos-processo").expect(401);
    expect(service.listar).not.toHaveBeenCalled();
  });
});

describe("POST /api/tipos-processo", () => {
  it("cria o tipo e responde 201", async () => {
    service.criar.mockResolvedValue({ id: "tipo-processo-1", ...VALIDO });

    await request(await subir())
      .post("/api/tipos-processo")
      .send(VALIDO)
      .expect(201, { tipo: { id: "tipo-processo-1", ...VALIDO } });
    expect(service.criar).toHaveBeenCalledWith(CTX_OWNER, expect.objectContaining(VALIDO));
  });

  it("responde 400 com detalhes para cor fora da paleta", async () => {
    const res = await request(await subir())
      .post("/api/tipos-processo")
      .send({ ...VALIDO, cor: "#abcdef" })
      .expect(400);

    expect(res.body.error).toBe("Dados inválidos");
    expect(res.body.detalhes.cor).toBeDefined();
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("responde 400 para JSON malformado", async () => {
    await request(await subir())
      .post("/api/tipos-processo")
      .set("content-type", "application/json")
      .send("nao-e-json")
      .expect(400, { error: "Dados inválidos" });
  });

  it("responde 403 quando o papel não pode configurar o escritório", async () => {
    service.criar.mockRejectedValue(new PermissaoNegadaError());

    await request(await subir()).post("/api/tipos-processo").send(VALIDO).expect(403, {
      error: "Você não tem permissão para executar esta ação.",
    });
  });

  it("responde 409 quando o nome já existe no escritório", async () => {
    service.criar.mockRejectedValue(new NomeTipoProcessoDuplicadoError());

    await request(await subir()).post("/api/tipos-processo").send(VALIDO).expect(409, {
      error: "Já existe um tipo de processo com este nome neste escritório.",
    });
  });
});

describe("PATCH /api/tipos-processo/:id", () => {
  it("atualiza parcialmente e responde 200", async () => {
    service.atualizar.mockResolvedValue({ id: "tipo-processo-1", nome: "Revisional" });

    await request(await subir())
      .patch("/api/tipos-processo/tipo-processo-1")
      .send({ nome: "Revisional" })
      .expect(200, { tipo: { id: "tipo-processo-1", nome: "Revisional" } });
    expect(service.atualizar).toHaveBeenCalledWith(CTX_OWNER, "tipo-processo-1", { nome: "Revisional" });
  });

  it("responde 400 para ícone fora da allow-list", async () => {
    await request(await subir())
      .patch("/api/tipos-processo/tipo-processo-1")
      .send({ icone: "IconeInventado" })
      .expect(400);
    expect(service.atualizar).not.toHaveBeenCalled();
  });

  it("responde 404 para tipo de outro escritório", async () => {
    service.atualizar.mockRejectedValue(new TipoProcessoNaoEncontradoError());

    await request(await subir())
      .patch("/api/tipos-processo/tipo-processo-1")
      .send({ nome: "X" })
      .expect(404, { error: "Tipo de processo não encontrado." });
  });
});

describe("DELETE /api/tipos-processo/:id", () => {
  it("exclui e responde { ok: true }", async () => {
    service.excluir.mockResolvedValue(undefined);

    await request(await subir()).delete("/api/tipos-processo/tipo-processo-1").expect(200, { ok: true });
    expect(service.excluir).toHaveBeenCalledWith(CTX_OWNER, "tipo-processo-1");
  });

  it("responde 409 quando o tipo tem processos vinculados (RN22)", async () => {
    service.excluir.mockRejectedValue(new TipoProcessoComCasosError());

    await request(await subir()).delete("/api/tipos-processo/tipo-processo-1").expect(409, {
      error: "Este tipo tem processos vinculados e não pode ser excluído.",
    });
  });

  it("responde 403 para papel sem permissão", async () => {
    service.excluir.mockRejectedValue(new PermissaoNegadaError());

    await request(await subir()).delete("/api/tipos-processo/tipo-processo-1").expect(403);
  });
});
