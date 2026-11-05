import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { StatusModule } from "./status.module";
import { STATUS_SERVICE, TIPO_STATUS_SERVICE } from "./tokens";
import { NaoAutenticadoError, SemEscritorioAtivoError } from "@dominio/lib/auth/resolver-tenant";

const tipoStatusService = { listar: jest.fn() };

describe("GET /api/tipos-status", () => {
  afterEach(() => jest.clearAllMocks());

  it("lista os tipos de status", async () => {
    tipoStatusService.listar.mockResolvedValue([{ id: "lead", nome: "Lead" }]);
    const app = await criarAppDeTeste({
      imports: [StatusModule],
      overrides: [[TIPO_STATUS_SERVICE, tipoStatusService], [STATUS_SERVICE, {}]],
    });

    await request(app.getHttpServer()).get("/api/tipos-status").expect(200, {
      tipos: [{ id: "lead", nome: "Lead" }],
    });
    expect(tipoStatusService.listar).toHaveBeenCalledWith(CTX_OWNER);
    await app.close();
  });

  it("responde 409 sem escritório ativo", async () => {
    const app = await criarAppDeTeste({
      imports: [StatusModule],
      ctx: new SemEscritorioAtivoError(),
      overrides: [[TIPO_STATUS_SERVICE, tipoStatusService]],
    });

    await request(app.getHttpServer()).get("/api/tipos-status").expect(409);
    await app.close();
  });

  it("responde 401 sem sessão e não chama o service", async () => {
    const app = await criarAppDeTeste({
      imports: [StatusModule],
      ctx: new NaoAutenticadoError(),
      overrides: [[TIPO_STATUS_SERVICE, tipoStatusService], [STATUS_SERVICE, {}]],
    });

    await request(app.getHttpServer()).get("/api/tipos-status").expect(401);
    expect(tipoStatusService.listar).not.toHaveBeenCalled();
    await app.close();
  });

  it("responde 500 genérico, sem vazar o erro interno", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    tipoStatusService.listar.mockRejectedValue(new Error("connection reset by peer"));
    const app = await criarAppDeTeste({
      imports: [StatusModule],
      overrides: [[TIPO_STATUS_SERVICE, tipoStatusService], [STATUS_SERVICE, {}]],
    });

    const res = await request(app.getHttpServer()).get("/api/tipos-status").expect(500);
    expect(res.body.error).not.toMatch(/connection reset/);
    spy.mockRestore();
    await app.close();
  });
});
