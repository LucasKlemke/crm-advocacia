import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { StatusModule } from "./status.module";
import { STATUS_SERVICE, TIPO_STATUS_SERVICE } from "./tokens";
import { SemEscritorioAtivoError } from "@/lib/auth/resolver-tenant";

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
});
