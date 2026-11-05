import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { DashboardModule } from "./dashboard.module";
import { DASHBOARD_SERVICE } from "./tokens";
import {
  AcessoNegadoError,
  NaoAutenticadoError,
  SemEscritorioAtivoError,
} from "@/lib/auth/resolver-tenant";

const service = { resumo: jest.fn() };

let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({ imports: [DashboardModule], ctx, overrides: [[DASHBOARD_SERVICE, service]] });
  return app.getHttpServer();
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  jest.clearAllMocks();
  await app?.close();
});

describe("GET /api/dashboard/resumo", () => {
  it("devolve o resumo montado pelo service, sem filtros", async () => {
    const resumo = { porTipoStatus: [{ tipoStatus: { id: "tipo-1" }, total: 2 }] };
    service.resumo.mockResolvedValue(resumo);

    await request(await subir()).get("/api/dashboard/resumo").expect(200, resumo);
    expect(service.resumo).toHaveBeenCalledWith(CTX_OWNER, {
      clienteIds: undefined,
      responsavelIds: undefined,
      dataInicio: undefined,
      dataFim: undefined,
    });
  });

  it("repassa só cliente, responsável e período da query ao service", async () => {
    service.resumo.mockResolvedValue({ porTipoStatus: [] });

    await request(await subir())
      .get(
        "/api/dashboard/resumo?clienteId=cli-1&responsavelId=membro-1&dataInicio=2026-01-01&dataFim=2026-08-01&statusId=s1&busca=x"
      )
      .expect(200);

    expect(service.resumo).toHaveBeenCalledWith(CTX_OWNER, {
      clienteIds: ["cli-1"],
      responsavelIds: ["membro-1"],
      dataInicio: new Date("2026-01-01"),
      dataFim: new Date("2026-08-01"),
    });
  });

  it.each([
    [new NaoAutenticadoError(), 401],
    [new SemEscritorioAtivoError(), 409],
    [new AcessoNegadoError(), 403],
  ])("responde o erro de tenant %p com %i", async (erro, status) => {
    await request(await subir(erro)).get("/api/dashboard/resumo").expect(status);
    expect(service.resumo).not.toHaveBeenCalled();
  });

  it("responde 500 sem vazar detalhe interno", async () => {
    service.resumo.mockRejectedValue(new Error("connection reset by peer"));

    const res = await request(await subir()).get("/api/dashboard/resumo").expect(500);
    expect(res.body.error).not.toMatch(/connection reset/);
  });
});
