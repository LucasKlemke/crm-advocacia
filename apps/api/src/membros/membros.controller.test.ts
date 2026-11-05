import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { MembrosModule } from "./membros.module";
import { MEMBRO_SERVICE, USUARIO_SERVICE_AVATAR } from "./tokens";
import {
  MembroNaoEncontradoError,
  PermissaoNegadaError,
  UltimoOwnerError,
} from "@/services/membro.service";
import {
  AcessoNegadoError,
  NaoAutenticadoError,
  SemEscritorioAtivoError,
} from "@/lib/auth/resolver-tenant";

const service = {
  listarMembros: jest.fn(),
  alterarRole: jest.fn(),
  remover: jest.fn(),
};
const assinar = async (chave: string | null) =>
  chave ? "https://bucket.s3.amazonaws.com/signed-get" : null;
const avatares = { assinarUrlAvatar: jest.fn(assinar) };

let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({
    imports: [MembrosModule],
    ctx,
    overrides: [
      [MEMBRO_SERVICE, service],
      [USUARIO_SERVICE_AVATAR, avatares],
    ],
  });
  return app.getHttpServer();
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  jest.clearAllMocks();
  avatares.assinarUrlAvatar.mockImplementation(assinar);
  await app?.close();
});

describe("GET /api/membros", () => {
  it.each([
    [new NaoAutenticadoError(), 401],
    [new SemEscritorioAtivoError(), 409],
    [new AcessoNegadoError(), 403],
  ])("responde o erro de tenant %p com %i", async (erro, status) => {
    await request(await subir(erro))
      .get("/api/membros")
      .expect(status);
    expect(service.listarMembros).not.toHaveBeenCalled();
  });

  it("lista os membros do escritório da sessão", async () => {
    service.listarMembros.mockResolvedValue([
      { id: "membro-1", usuario: { avatarUrl: null } },
    ]);

    await request(await subir())
      .get("/api/membros")
      .expect(200, {
        membros: [{ id: "membro-1", usuario: { avatarUrl: null } }],
      });
    expect(service.listarMembros).toHaveBeenCalledWith(CTX_OWNER);
  });

  it("responde 500 genérico para erro inesperado", async () => {
    service.listarMembros.mockRejectedValue(new Error("boom"));

    await request(await subir())
      .get("/api/membros")
      .expect(500, { error: "Não foi possível concluir a operação." });
  });
});

describe("PATCH /api/membros/:id", () => {
  it.each([
    [new NaoAutenticadoError(), 401],
    [new SemEscritorioAtivoError(), 409],
    [new AcessoNegadoError(), 403],
  ])("responde o erro de tenant %p com %i", async (erro, status) => {
    await request(await subir(erro))
      .patch("/api/membros/membro-1")
      .send({ role: "admin" })
      .expect(status);
    expect(service.alterarRole).not.toHaveBeenCalled();
  });

  it("altera o papel e devolve o membro", async () => {
    service.alterarRole.mockResolvedValue({ id: "membro-1", role: "admin" });

    await request(await subir())
      .patch("/api/membros/membro-1")
      .send({ role: "admin" })
      .expect(200, { membro: { id: "membro-1", role: "admin" } });
    expect(service.alterarRole).toHaveBeenCalledWith(
      CTX_OWNER,
      "membro-1",
      "admin",
    );
  });

  it("responde 400 para role inválido", async () => {
    await request(await subir())
      .patch("/api/membros/membro-1")
      .send({ role: "invalido" })
      .expect(400);
    expect(service.alterarRole).not.toHaveBeenCalled();
  });

  it("responde 400 para JSON malformado", async () => {
    await request(await subir())
      .patch("/api/membros/membro-1")
      .set("Content-Type", "application/json")
      .send("{malformado")
      .expect(400);
    expect(service.alterarRole).not.toHaveBeenCalled();
  });

  it.each([
    [new MembroNaoEncontradoError(), 404],
    [new PermissaoNegadaError(), 403],
    [new UltimoOwnerError(), 409],
  ])("mapeia %p para %i", async (erro, status) => {
    service.alterarRole.mockRejectedValue(erro);

    await request(await subir())
      .patch("/api/membros/membro-1")
      .send({ role: "admin" })
      .expect(status, { error: erro.message });
  });

  it("responde 500 genérico para erro inesperado", async () => {
    service.alterarRole.mockRejectedValue(new Error("boom"));

    await request(await subir())
      .patch("/api/membros/membro-1")
      .send({ role: "admin" })
      .expect(500, { error: "Não foi possível concluir a operação." });
  });
});

describe("DELETE /api/membros/:id", () => {
  it.each([
    [new NaoAutenticadoError(), 401],
    [new SemEscritorioAtivoError(), 409],
    [new AcessoNegadoError(), 403],
  ])("responde o erro de tenant %p com %i", async (erro, status) => {
    await request(await subir(erro))
      .delete("/api/membros/membro-1")
      .expect(status);
    expect(service.remover).not.toHaveBeenCalled();
  });

  it("remove e responde { ok: true }", async () => {
    service.remover.mockResolvedValue(undefined);

    await request(await subir())
      .delete("/api/membros/membro-1")
      .expect(200, { ok: true });
    expect(service.remover).toHaveBeenCalledWith(CTX_OWNER, "membro-1");
  });

  it.each([
    [new MembroNaoEncontradoError(), 404],
    [new PermissaoNegadaError(), 403],
    [new UltimoOwnerError(), 409],
  ])("mapeia %p para %i", async (erro, status) => {
    service.remover.mockRejectedValue(erro);

    await request(await subir())
      .delete("/api/membros/membro-1")
      .expect(status, { error: erro.message });
  });

  it("responde 500 genérico para erro inesperado", async () => {
    service.remover.mockRejectedValue(new Error("boom"));

    await request(await subir())
      .delete("/api/membros/membro-1")
      .expect(500, { error: "Não foi possível concluir a operação." });
  });
});

describe("GET /api/membros — avatar", () => {
  it("assina o avatarUrl de cada membro antes de responder", async () => {
    service.listarMembros.mockResolvedValue([
      {
        id: "membro-1",
        role: "owner",
        usuario: {
          id: "user-1",
          nome: "Dona Owner",
          email: "owner@teste.com",
          telefone: null,
          avatarUrl: "development/avatares/user-1/foto.png",
        },
      },
      {
        id: "membro-2",
        role: "padrao",
        usuario: {
          id: "user-2",
          nome: "Sem Foto",
          email: "s@teste.com",
          telefone: null,
          avatarUrl: null,
        },
      },
    ]);

    const res = await request(await subir())
      .get("/api/membros")
      .expect(200);

    expect(avatares.assinarUrlAvatar).toHaveBeenCalledWith(
      "development/avatares/user-1/foto.png",
    );
    expect(res.body.membros[0].usuario.avatarUrl).toBe(
      "https://bucket.s3.amazonaws.com/signed-get",
    );
    expect(res.body.membros[1].usuario.avatarUrl).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain("senhaHash");
  });
});
