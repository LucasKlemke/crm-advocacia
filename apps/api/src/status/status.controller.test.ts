import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { StatusModule } from "./status.module";
import { STATUS_SERVICE } from "./tokens";
import {
  StatusNaoEncontradoError,
  NomeStatusDuplicadoError,
  StatusComCasosError,
  TipoStatusInvalidoError,
  PermissaoNegadaError,
} from "@/services/status.service";
import { NaoAutenticadoError } from "@/lib/auth/resolver-tenant";

const TIPO_ID = "123e4567-e89b-12d3-a456-426614174000";
const corpoValido = { nome: "Lead", tipoStatusId: TIPO_ID, icone: "UserPlus", cor: "#64748b" };

const service = {
  listar: jest.fn(),
  criar: jest.fn(),
  atualizar: jest.fn(),
  excluir: jest.fn(),
};

let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({ imports: [StatusModule], ctx, overrides: [[STATUS_SERVICE, service]] });
  return app.getHttpServer();
}

afterEach(async () => {
  jest.clearAllMocks();
  await app?.close();
});

describe("GET /api/status", () => {
  it("lista os status do escritório da sessão", async () => {
    service.listar.mockResolvedValue([{ id: "s1", nome: "Lead" }]);

    await request(await subir()).get("/api/status").expect(200, { status: [{ id: "s1", nome: "Lead" }] });
    expect(service.listar).toHaveBeenCalledWith(CTX_OWNER);
  });

  it("responde 401 sem sessão e não chama o service (RN19)", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/status").expect(401);
    expect(service.listar).not.toHaveBeenCalled();
  });
});

describe("POST /api/status", () => {
  it("cria e responde 201", async () => {
    service.criar.mockResolvedValue({ id: "s1", ...corpoValido });

    await request(await subir()).post("/api/status").send(corpoValido).expect(201, {
      status: { id: "s1", ...corpoValido },
    });
    expect(service.criar).toHaveBeenCalledWith(CTX_OWNER, corpoValido);
  });

  it("responde 400 com detalhes quando o payload é inválido", async () => {
    const res = await request(await subir()).post("/api/status").send({ ...corpoValido, nome: "" }).expect(400);

    expect(res.body.error).toBe("Dados inválidos");
    expect(res.body.detalhes.nome).toBeDefined();
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("responde 409 para nome duplicado", async () => {
    service.criar.mockRejectedValue(new NomeStatusDuplicadoError());

    await request(await subir()).post("/api/status").send(corpoValido).expect(409, {
      error: "Já existe um status com este nome neste escritório.",
    });
  });

  it("responde 403 quando o papel não permite", async () => {
    service.criar.mockRejectedValue(new PermissaoNegadaError());

    await request(await subir()).post("/api/status").send(corpoValido).expect(403);
  });
});

describe("PATCH /api/status/:id", () => {
  it("atualiza parcialmente", async () => {
    service.atualizar.mockResolvedValue({ id: "s1", nome: "Novo" });

    await request(await subir()).patch("/api/status/s1").send({ nome: "Novo" }).expect(200, {
      status: { id: "s1", nome: "Novo" },
    });
    expect(service.atualizar).toHaveBeenCalledWith(CTX_OWNER, "s1", { nome: "Novo" });
  });

  it("responde 404 quando o status não é do escritório", async () => {
    service.atualizar.mockRejectedValue(new StatusNaoEncontradoError());

    await request(await subir()).patch("/api/status/s1").send({ nome: "Novo" }).expect(404, {
      error: "Status não encontrado.",
    });
  });
});

describe("DELETE /api/status/:id", () => {
  it("exclui e responde { ok: true }", async () => {
    service.excluir.mockResolvedValue(undefined);

    await request(await subir()).delete("/api/status/s1").expect(200, { ok: true });
    expect(service.excluir).toHaveBeenCalledWith(CTX_OWNER, "s1");
  });

  it("responde 409 quando há casos vinculados (RN09)", async () => {
    service.excluir.mockRejectedValue(new StatusComCasosError());

    await request(await subir()).delete("/api/status/s1").expect(409, {
      error: "Este status tem processos vinculados e não pode ser excluído.",
    });
  });
});

describe("caminhos de erro (portados das rotas Next)", () => {
  it("POST responde 400 quando tipoStatusId não é uuid", async () => {
    const res = await request(await subir()).post("/api/status").send({ ...corpoValido, tipoStatusId: "nao-e-uuid" }).expect(400);
    expect(res.body.detalhes.tipoStatusId).toBeDefined();
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("POST responde 400 com detalhes para ícone inexistente", async () => {
    const res = await request(await subir()).post("/api/status").send({ ...corpoValido, icone: "IconeInexistente" }).expect(400);
    expect(res.body.detalhes.icone).toBeDefined();
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("POST responde 400 quando o corpo não é JSON", async () => {
    await request(await subir())
      .post("/api/status")
      .set("Content-Type", "application/json")
      .send("nao-e-json")
      .expect(400);
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("POST responde 400 para TipoStatusInvalidoError vindo do service", async () => {
    service.criar.mockRejectedValue(new TipoStatusInvalidoError());
    const res = await request(await subir()).post("/api/status").send(corpoValido).expect(400);
    expect(res.body.error).toEqual(expect.any(String));
  });

  it("POST responde 500 genérico, sem vazar o erro interno", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    service.criar.mockRejectedValue(new Error("connection reset by peer"));
    const res = await request(await subir()).post("/api/status").send(corpoValido).expect(500);
    expect(res.body.error).not.toMatch(/connection reset/);
    spy.mockRestore();
  });

  it("PATCH responde 400 com detalhes quando o nome é vazio", async () => {
    const res = await request(await subir()).patch("/api/status/s1").send({ nome: "" }).expect(400);
    expect(res.body.detalhes.nome).toBeDefined();
    expect(service.atualizar).not.toHaveBeenCalled();
  });

  it("PATCH responde 409 em colisão de nome", async () => {
    service.atualizar.mockRejectedValue(new NomeStatusDuplicadoError());
    await request(await subir()).patch("/api/status/s1").send({ nome: "Já Usado" }).expect(409);
  });

  it("PATCH responde 403 quando o papel não permite", async () => {
    service.atualizar.mockRejectedValue(new PermissaoNegadaError());
    await request(await subir()).patch("/api/status/s1").send({ nome: "Novo" }).expect(403);
  });

  it("PATCH responde 401 sem sessão e não chama o service", async () => {
    await request(await subir(new NaoAutenticadoError())).patch("/api/status/s1").send({ nome: "Novo" }).expect(401);
    expect(service.atualizar).not.toHaveBeenCalled();
  });

  it("DELETE responde 404 para status de outro escritório", async () => {
    service.excluir.mockRejectedValue(new StatusNaoEncontradoError());
    await request(await subir()).delete("/api/status/s1").expect(404);
  });

  it("DELETE responde 403 quando o papel não permite", async () => {
    service.excluir.mockRejectedValue(new PermissaoNegadaError());
    await request(await subir()).delete("/api/status/s1").expect(403);
  });
});
