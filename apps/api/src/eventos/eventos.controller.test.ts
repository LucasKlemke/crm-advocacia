import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { EventosModule } from "./eventos.module";
import { EVENTO_SERVICE, SERIALIZADOR_EVENTO } from "./tokens";
import {
  EventoNaoEncontradoError,
  ModalidadeEventoInvalidaError,
  ParticipanteInvalidoError,
  PermissaoNegadaError,
  VinculoEventoExclusivoError,
} from "@dominio/services/evento.service";
import { NaoAutenticadoError } from "@dominio/lib/auth/resolver-tenant";

const service = {
  membroAtual: jest.fn(),
  listarNoPeriodo: jest.fn(),
  criar: jest.fn(),
  obter: jest.fn(),
  atualizar: jest.fn(),
  excluir: jest.fn(),
  podeEditar: jest.fn(),
};

// O mock aplica o callback de permissão de verdade: é ele que leva `podeEditar` ao DTO
// (RN34), e um mock que ignora o callback esconderia o controller passando o membro errado.
const serializador = {
  serializarEventos: jest.fn(async (eventos: Record<string, unknown>[], podeEditar: (e: unknown) => boolean) =>
    eventos.map((evento) => ({ ...evento, podeEditar: podeEditar(evento) }))
  ),
  serializarEvento: jest.fn(async (evento: Record<string, unknown>, podeEditar: (e: unknown) => boolean) => ({
    ...evento,
    podeEditar: podeEditar(evento),
  })),
};

const PERIODO = "inicio=2026-09-01T00:00:00.000Z&fim=2026-09-30T23:59:59.999Z";
const VALIDO = {
  titulo: "Audiência de instrução",
  inicio: "2026-09-10T13:00:00.000Z",
  fim: "2026-09-10T14:00:00.000Z",
  modalidade: "presencial",
  local: "Fórum de Joinville",
};

let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({
    imports: [EventosModule],
    ctx,
    overrides: [
      [EVENTO_SERVICE, service],
      [SERIALIZADOR_EVENTO, serializador],
    ],
  });
  return app.getHttpServer();
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  service.membroAtual.mockResolvedValue({ id: "membro-1" });
  service.podeEditar.mockReturnValue(true);
  service.obter.mockResolvedValue({ id: "evento-1", titulo: "Audiência" });
});

afterEach(async () => {
  jest.clearAllMocks();
  await app?.close();
});

describe("GET /api/eventos", () => {
  it("lista os eventos do período", async () => {
    service.listarNoPeriodo.mockResolvedValue([{ id: "evento-1" }]);

    await request(await subir())
      .get(`/api/eventos?${PERIODO}`)
      .expect(200, { eventos: [{ id: "evento-1", podeEditar: true }] });
    expect(service.listarNoPeriodo).toHaveBeenCalledWith(CTX_OWNER, {
      inicio: new Date("2026-09-01T00:00:00.000Z"),
      fim: new Date("2026-09-30T23:59:59.999Z"),
    });
  });

  it("responde 400 sem o período ou com período invertido", async () => {
    const server = await subir();

    const semFim = await request(server).get("/api/eventos?inicio=2026-09-01T00:00:00.000Z").expect(400);
    expect(semFim.body.error).toBe("Dados inválidos");
    expect(semFim.body.detalhes.fim).toBeDefined();

    await request(server)
      .get("/api/eventos?inicio=2026-09-30T00:00:00.000Z&fim=2026-09-01T00:00:00.000Z")
      .expect(400);
    expect(service.listarNoPeriodo).not.toHaveBeenCalled();
  });

  it("resolve podeEditar por evento com o membro da sessão (RN34)", async () => {
    service.listarNoPeriodo.mockResolvedValue([{ id: "evento-1" }]);
    service.podeEditar.mockReturnValue(false);

    const res = await request(await subir()).get(`/api/eventos?${PERIODO}`).expect(200);

    expect(res.body.eventos[0].podeEditar).toBe(false);
    expect(service.podeEditar).toHaveBeenCalledWith(CTX_OWNER, "membro-1", { id: "evento-1" });
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).get(`/api/eventos?${PERIODO}`).expect(401);
  });
});

describe("POST /api/eventos", () => {
  it("cria e devolve 201 com o evento recarregado", async () => {
    service.criar.mockResolvedValue({ id: "evento-1" });
    service.obter.mockResolvedValue({ id: "evento-1", titulo: VALIDO.titulo });

    await request(await subir())
      .post("/api/eventos")
      .send(VALIDO)
      .expect(201, { evento: { id: "evento-1", titulo: VALIDO.titulo, podeEditar: true } });
    // O schema de criação aplica os defaults (diaInteiro=false, participantes=[]).
    expect(service.criar).toHaveBeenCalledWith(
      CTX_OWNER,
      expect.objectContaining({ ...VALIDO, diaInteiro: false, participanteMembroIds: [] })
    );
    expect(service.obter).toHaveBeenCalledWith(CTX_OWNER, "evento-1");
  });

  it("responde 400 para corpo inválido e para JSON malformado", async () => {
    const server = await subir();

    await request(server).post("/api/eventos").send({ ...VALIDO, titulo: "" }).expect(400);
    await request(server)
      .post("/api/eventos")
      .set("content-type", "application/json")
      .send("{ nao json")
      .expect(400);
    expect(service.criar).not.toHaveBeenCalled();
  });

  it.each([
    [new VinculoEventoExclusivoError()],
    [new ModalidadeEventoInvalidaError("Informe o link da reunião.")],
    [new ParticipanteInvalidoError()],
  ])("responde 422 quando %p viola a regra", async (erro) => {
    service.criar.mockRejectedValue(erro);

    await request(await subir()).post("/api/eventos").send(VALIDO).expect(422, { error: erro.message });
  });

  it("responde 403 quando a permissão é negada", async () => {
    service.criar.mockRejectedValue(new PermissaoNegadaError());

    await request(await subir()).post("/api/eventos").send(VALIDO).expect(403);
  });

  it("responde 500 genérico em erro inesperado", async () => {
    service.criar.mockRejectedValue(new Error("boom"));

    await request(await subir())
      .post("/api/eventos")
      .send(VALIDO)
      .expect(500, { error: "Não foi possível concluir a operação." });
  });
});

describe("GET /api/eventos/:id", () => {
  it("devolve o evento do escritório", async () => {
    await request(await subir())
      .get("/api/eventos/evento-1")
      .expect(200, { evento: { id: "evento-1", titulo: "Audiência", podeEditar: true } });
    expect(service.obter).toHaveBeenCalledWith(CTX_OWNER, "evento-1");
  });

  it("resolve podeEditar com o membro da sessão (RN34)", async () => {
    service.podeEditar.mockReturnValue(false);

    const res = await request(await subir()).get("/api/eventos/evento-1").expect(200);

    expect(res.body.evento.podeEditar).toBe(false);
    expect(service.podeEditar).toHaveBeenCalledWith(CTX_OWNER, "membro-1", {
      id: "evento-1",
      titulo: "Audiência",
    });
  });

  it("responde 404 para evento de outro escritório ou já excluído (RN19/RN34)", async () => {
    const erro = new EventoNaoEncontradoError();
    service.obter.mockRejectedValue(erro);

    await request(await subir()).get("/api/eventos/evento-1").expect(404, { error: erro.message });
  });
});

describe("PATCH /api/eventos/:id", () => {
  it("atualiza e devolve o evento recarregado", async () => {
    service.atualizar.mockResolvedValue(undefined);

    await request(await subir())
      .patch("/api/eventos/evento-1")
      .send({ titulo: "Audiência remarcada" })
      .expect(200, { evento: { id: "evento-1", titulo: "Audiência", podeEditar: true } });
    // Sem defaults no PATCH: só o que veio no corpo chega ao service.
    expect(service.atualizar).toHaveBeenCalledWith(CTX_OWNER, "evento-1", { titulo: "Audiência remarcada" });
    expect(service.obter).toHaveBeenCalledWith(CTX_OWNER, "evento-1");
  });

  it("responde 400 para corpo inválido", async () => {
    await request(await subir()).patch("/api/eventos/evento-1").send({ inicio: "ontem" }).expect(400);
    expect(service.atualizar).not.toHaveBeenCalled();
  });

  it("responde 403 para quem não é autor nem gestor (RN34)", async () => {
    service.atualizar.mockRejectedValue(new PermissaoNegadaError());

    await request(await subir()).patch("/api/eventos/evento-1").send({ titulo: "Remarcado" }).expect(403);
  });

  it("responde 422 quando a modalidade fica inconsistente (RN32)", async () => {
    service.atualizar.mockRejectedValue(new ModalidadeEventoInvalidaError("Informe o link da reunião."));

    await request(await subir()).patch("/api/eventos/evento-1").send({ modalidade: "online" }).expect(422);
  });
});

describe("DELETE /api/eventos/:id", () => {
  it("exclui e responde { ok: true }", async () => {
    service.excluir.mockResolvedValue(undefined);

    await request(await subir()).delete("/api/eventos/evento-1").expect(200, { ok: true });
    expect(service.excluir).toHaveBeenCalledWith(CTX_OWNER, "evento-1");
  });

  it.each([
    [new PermissaoNegadaError(), 403],
    [new EventoNaoEncontradoError(), 404],
  ])("mapeia %p para %i", async (erro, status) => {
    service.excluir.mockRejectedValue(erro);

    await request(await subir()).delete("/api/eventos/evento-1").expect(status);
  });
});
