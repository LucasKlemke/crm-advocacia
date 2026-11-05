import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { ComentariosModule } from "./comentarios.module";
import { COMENTARIO_SERVICE, USUARIO_SERVICE } from "./tokens";
import {
  ComentarioNaoEncontradoError,
  PermissaoComentarioError,
} from "@/services/comentario.service";
import { ClienteNaoEncontradoError } from "@/services/cliente.service";
import { CasoNaoEncontradoError } from "@/services/caso.service";
import { NaoAutenticadoError } from "@/lib/auth/resolver-tenant";

const CLIENTE_ID = "11111111-1111-4111-8111-111111111111";
const QUERY = `escopo=cliente&escopoId=${CLIENTE_ID}`;

const service = { listar: jest.fn(), criar: jest.fn(), atualizar: jest.fn(), excluir: jest.fn() };
const usuarios = { assinarUrlAvatar: jest.fn() };

let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({
    imports: [ComentariosModule],
    ctx,
    overrides: [
      [COMENTARIO_SERVICE, service],
      [USUARIO_SERVICE, usuarios],
    ],
  });
  return app.getHttpServer();
}

afterEach(async () => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  await app?.close();
});

describe("GET /api/comentarios", () => {
  it("lista os comentários do escopo pedido", async () => {
    service.listar.mockResolvedValue([]);

    await request(await subir()).get(`/api/comentarios?${QUERY}`).expect(200, { comentarios: [] });
    expect(service.listar).toHaveBeenCalledWith(CTX_OWNER, "cliente", CLIENTE_ID);
  });

  it("assina o avatarUrl do autor de cada comentário", async () => {
    usuarios.assinarUrlAvatar.mockResolvedValue("https://bucket.s3.amazonaws.com/signed-get");
    service.listar.mockResolvedValue([
      {
        id: "com-1",
        conteudo: "Olá",
        autor: { id: "user-1", nome: "Fulano", email: "fulano@teste.com", avatarUrl: "development/avatares/user-1/foto.png" },
      },
    ]);

    const res = await request(await subir()).get(`/api/comentarios?${QUERY}`).expect(200);

    expect(usuarios.assinarUrlAvatar).toHaveBeenCalledWith("development/avatares/user-1/foto.png");
    expect(res.body.comentarios[0]).toEqual({
      id: "com-1",
      conteudo: "Olá",
      autor: {
        id: "user-1",
        nome: "Fulano",
        email: "fulano@teste.com",
        avatarUrl: "https://bucket.s3.amazonaws.com/signed-get",
      },
    });
  });

  it("recusa escopo desconhecido com 400 e detalhes", async () => {
    const res = await request(await subir())
      .get(`/api/comentarios?escopo=processo&escopoId=${CLIENTE_ID}`)
      .expect(400);

    expect(res.body.error).toBe("Dados inválidos");
    expect(res.body.detalhes.escopo).toBeDefined();
    expect(service.listar).not.toHaveBeenCalled();
  });

  it("recusa requisição sem escopoId", async () => {
    const res = await request(await subir()).get("/api/comentarios?escopo=cliente").expect(400);
    expect(res.body.detalhes.escopoId).toBeDefined();
  });

  // O alvo é validado pelo service contra o tenant (RN21); a rota traduz para 404.
  it("responde 404 quando o cliente alvo não é do escritório", async () => {
    service.listar.mockRejectedValue(new ClienteNaoEncontradoError());

    await request(await subir()).get(`/api/comentarios?${QUERY}`).expect(404, { error: "Cliente não encontrado." });
  });

  it("responde 404 quando o caso alvo não é do escritório", async () => {
    service.listar.mockRejectedValue(new CasoNaoEncontradoError());

    await request(await subir())
      .get(`/api/comentarios?escopo=caso&escopoId=${CLIENTE_ID}`)
      .expect(404, { error: "Processo não encontrado." });
  });

  it("responde 404 quando o service não encontra o comentário", async () => {
    service.listar.mockRejectedValue(new ComentarioNaoEncontradoError());

    await request(await subir()).get(`/api/comentarios?${QUERY}`).expect(404);
  });

  it("responde 401 sem sessão e não valida a query antes do tenant", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/comentarios").expect(401);
  });
});

describe("POST /api/comentarios", () => {
  it("responde 400 quando o body não é JSON", async () => {
    await request(await subir())
      .post("/api/comentarios")
      .set("content-type", "application/json")
      .send("nao-e-json")
      .expect(400, { error: "Dados inválidos" });
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("responde 404 quando o cliente alvo não é do escritório", async () => {
    service.criar.mockRejectedValue(new ClienteNaoEncontradoError());

    await request(await subir())
      .post("/api/comentarios")
      .send({ escopo: "cliente", escopoId: CLIENTE_ID, conteudo: "oi" })
      .expect(404);
  });

  it("responde 500 sem vazar detalhe interno em erro inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.criar.mockRejectedValue(new Error("connection reset by peer"));

    await request(await subir())
      .post("/api/comentarios")
      .send({ escopo: "cliente", escopoId: CLIENTE_ID, conteudo: "oi" })
      .expect(500, { error: "Não foi possível concluir a operação." });
  });

  it("cria o comentário (conteúdo aparado) e responde 201", async () => {
    service.criar.mockResolvedValue({ id: "com-1" });

    await request(await subir())
      .post("/api/comentarios")
      .send({ escopo: "cliente", escopoId: CLIENTE_ID, conteudo: "  Primeiro contato feito.  " })
      .expect(201, { comentario: { id: "com-1" } });
    expect(service.criar).toHaveBeenCalledWith(CTX_OWNER, "cliente", CLIENTE_ID, "Primeiro contato feito.");
  });

  it("recusa comentário vazio", async () => {
    await request(await subir())
      .post("/api/comentarios")
      .send({ escopo: "cliente", escopoId: CLIENTE_ID, conteudo: "   " })
      .expect(400);
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError()))
      .post("/api/comentarios")
      .send({ escopo: "cliente", escopoId: CLIENTE_ID, conteudo: "oi" })
      .expect(401);
  });
});

describe("PATCH /api/comentarios/:id", () => {
  it("edita o conteúdo", async () => {
    service.atualizar.mockResolvedValue({ id: "com-1" });

    await request(await subir())
      .patch("/api/comentarios/com-1")
      .send({ conteudo: "Texto novo" })
      .expect(200, { comentario: { id: "com-1" } });
    expect(service.atualizar).toHaveBeenCalledWith(CTX_OWNER, "com-1", "Texto novo");
  });

  it("recusa conteúdo vazio", async () => {
    await request(await subir()).patch("/api/comentarios/com-1").send({ conteudo: "  " }).expect(400);
    expect(service.atualizar).not.toHaveBeenCalled();
  });

  it("responde 403 quando quem edita não é o autor (RN21)", async () => {
    service.atualizar.mockRejectedValue(new PermissaoComentarioError());

    await request(await subir()).patch("/api/comentarios/com-1").send({ conteudo: "Texto novo" }).expect(403, {
      error: "Você não tem permissão para alterar este comentário.",
    });
  });

  it("responde 404 para comentário de outro escritório", async () => {
    service.atualizar.mockRejectedValue(new ComentarioNaoEncontradoError());

    await request(await subir()).patch("/api/comentarios/com-1").send({ conteudo: "Texto novo" }).expect(404, {
      error: "Comentário não encontrado.",
    });
  });
});

describe("DELETE /api/comentarios/:id", () => {
  it("exclui (soft) o comentário", async () => {
    service.excluir.mockResolvedValue(undefined);

    await request(await subir()).delete("/api/comentarios/com-1").expect(200, { ok: true });
    expect(service.excluir).toHaveBeenCalledWith(CTX_OWNER, "com-1");
  });

  it("responde 403 quando não há permissão de moderar", async () => {
    service.excluir.mockRejectedValue(new PermissaoComentarioError());

    await request(await subir()).delete("/api/comentarios/com-1").expect(403);
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).delete("/api/comentarios/com-1").expect(401);
    expect(service.excluir).not.toHaveBeenCalled();
  });
});
