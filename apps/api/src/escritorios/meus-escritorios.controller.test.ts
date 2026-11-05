import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { EscritoriosModule } from "./escritorios.module";
import { MEMBRO_SERVICE_DO_USUARIO } from "./tokens";
import { NaoAutenticadoError } from "@dominio/lib/auth/resolver-tenant";

const membros = { listarEscritoriosDoUsuario: jest.fn() };
let app: INestApplication;

async function subir(usuarioId?: string | Error) {
  app = await criarAppDeTeste({
    imports: [EscritoriosModule],
    usuarioId,
    overrides: [[MEMBRO_SERVICE_DO_USUARIO, membros]],
  });
  return app.getHttpServer();
}

afterEach(async () => {
  jest.clearAllMocks();
  await app?.close();
});

describe("GET /api/escritorios", () => {
  it("lista só id, nome e papel de cada escritório do usuário da sessão", async () => {
    membros.listarEscritoriosDoUsuario.mockResolvedValue([
      {
        escritorio: { id: "esc-1", nome: "Um", oabResponsavel: "SC 1", telefoneWhatsapp: null },
        role: "owner",
      },
      {
        escritorio: { id: "esc-2", nome: "Dois", oabResponsavel: null, telefoneWhatsapp: "5548" },
        role: "padrao",
      },
    ]);

    await request(await subir())
      .get("/api/escritorios")
      .expect(200, {
        escritorios: [
          { id: "esc-1", nome: "Um", role: "owner" },
          { id: "esc-2", nome: "Dois", role: "padrao" },
        ],
      });
    expect(membros.listarEscritoriosDoUsuario).toHaveBeenCalledWith(CTX_OWNER.usuarioId);
  });

  it("responde 401 sem sessão e não consulta o banco", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/escritorios").expect(401);
    expect(membros.listarEscritoriosDoUsuario).not.toHaveBeenCalled();
  });
});
