import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { PerfilModule } from "./perfil.module";
import { USUARIO_SERVICE_PERFIL } from "./tokens";
import { NaoAutenticadoError } from "@dominio/lib/auth/resolver-tenant";

const usuarios = { obterPerfil: jest.fn() };
let app: INestApplication;

async function subir(usuarioId?: string | Error) {
  app = await criarAppDeTeste({
    imports: [PerfilModule],
    usuarioId,
    overrides: [[USUARIO_SERVICE_PERFIL, usuarios]],
  });
  return app.getHttpServer();
}

afterEach(async () => {
  jest.clearAllMocks();
  await app?.close();
});

describe("GET /api/perfil", () => {
  it("devolve os dados do banco, sem senhaHash e sem a chave do avatar", async () => {
    usuarios.obterPerfil.mockResolvedValue({
      id: "user-1",
      nome: "Nome Novo",
      email: "novo@teste.com",
      senhaHash: "$2b$10$segredo",
      avatarUrl: "development/avatares/user-1/foto.png",
      telefone: null,
    });

    const res = await request(await subir()).get("/api/perfil").expect(200);

    expect(res.body).toEqual({
      usuario: { id: "user-1", nome: "Nome Novo", email: "novo@teste.com", temAvatar: true },
    });
    expect(usuarios.obterPerfil).toHaveBeenCalledWith(CTX_OWNER.usuarioId);
  });

  it("temAvatar é false quando o usuário não tem foto", async () => {
    usuarios.obterPerfil.mockResolvedValue({
      id: "user-1",
      nome: "N",
      email: "n@teste.com",
      senhaHash: "x",
      avatarUrl: null,
    });

    const res = await request(await subir()).get("/api/perfil").expect(200);
    expect(res.body.usuario.temAvatar).toBe(false);
  });

  it("responde 401 quando o usuário da sessão não existe mais", async () => {
    usuarios.obterPerfil.mockResolvedValue(null);

    await request(await subir()).get("/api/perfil").expect(401);
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/perfil").expect(401);
    expect(usuarios.obterPerfil).not.toHaveBeenCalled();
  });
});
