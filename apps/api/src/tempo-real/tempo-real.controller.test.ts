import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { NaoAutenticadoError } from "@dominio/lib/auth/resolver-tenant";
import { verificarTicketWs } from "@dominio/lib/auth/sessao-jwt";
import { TempoRealModule } from "./tempo-real.module";
import { AGENDADOR_SINCRONIZACAO, CONFIG_TEMPO_REAL } from "./tokens";
import type { ConfigTempoReal } from "./config-tempo-real";

const CONFIG: ConfigTempoReal = { habilitado: true, pollingMs: 0, origensWeb: [] };
const ambienteOriginal = { ...process.env };

async function criarApp(opcoes: { ctx?: typeof CTX_OWNER | Error; config?: ConfigTempoReal } = {}) {
  return criarAppDeTeste({
    imports: [TempoRealModule],
    ctx: opcoes.ctx,
    overrides: [
      [AGENDADOR_SINCRONIZACAO, { agendarInstancia: jest.fn(), iniciarPolling: jest.fn(), parar: jest.fn() }],
      [CONFIG_TEMPO_REAL, opcoes.config ?? CONFIG],
    ],
  });
}

describe("GET /api/tempo-real/ticket", () => {
  let app: INestApplication;

  beforeEach(() => {
    process.env = { ...ambienteOriginal, AUTH_SECRET: "segredo-de-teste-com-pelo-menos-32-caracteres" };
  });

  afterEach(async () => {
    await app?.close();
    process.env = ambienteOriginal;
  });

  it("200 com um ticket verificável preso ao usuário e ao escritório da sessão, sem cache", async () => {
    app = await criarApp();

    const resposta = await request(app.getHttpServer()).get("/api/tempo-real/ticket").expect(200);

    expect(Object.keys(resposta.body)).toEqual(["ticket"]);
    expect(resposta.headers["cache-control"]).toBe("no-store");
    await expect(verificarTicketWs(resposta.body.ticket)).resolves.toEqual({
      sub: CTX_OWNER.usuarioId,
      escritorioId: CTX_OWNER.escritorioId,
      jti: expect.any(String),
    });
  });

  it("401 sem sessão", async () => {
    app = await criarApp({ ctx: new NaoAutenticadoError() });

    await request(app.getHttpServer())
      .get("/api/tempo-real/ticket")
      .expect(401, { error: "Sessão inválida ou expirada." });
  });

  it("404 com o tempo real desabilitado, mesmo com sessão", async () => {
    app = await criarApp({ config: { ...CONFIG, habilitado: false } });

    await request(app.getHttpServer()).get("/api/tempo-real/ticket").expect(404);
  });

  it("404 com o tempo real desabilitado também sem sessão (não revela a rota)", async () => {
    app = await criarApp({ ctx: new NaoAutenticadoError(), config: { ...CONFIG, habilitado: false } });

    await request(app.getHttpServer()).get("/api/tempo-real/ticket").expect(404);
  });
});
