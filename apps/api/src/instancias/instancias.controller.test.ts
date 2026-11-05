import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { InstanciasModule } from "./instancias.module";
import { INSTANCIAS_SERVICE } from "./tokens";
import {
  InstanciaWhatsappNaoEncontradaError,
  NomeInstanciaDuplicadoError,
  PermissaoNegadaError,
} from "@/services/instancia-whatsapp.service";
import { UazapiIndisponivelError } from "@/lib/external/uazapi-client";
import { NaoAutenticadoError } from "@/lib/auth/resolver-tenant";

const ERRO_500 = { error: "Não foi possível concluir a operação." };

const service = {
  listar: jest.fn(),
  criarEConectar: jest.fn(),
  sincronizarTodas: jest.fn(),
  excluir: jest.fn(),
  verificarStatus: jest.fn(),
  desconectar: jest.fn(),
  reconectar: jest.fn(),
};

let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({
    imports: [InstanciasModule],
    ctx,
    overrides: [[INSTANCIAS_SERVICE, service]],
  });
  return app.getHttpServer();
}

afterEach(async () => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  await app?.close();
});

function silenciarConsoleError() {
  jest.spyOn(console, "error").mockImplementation(() => {});
}

describe("GET /api/instancias", () => {
  it("responde 401 sem sessão e não chama o service (RN19)", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/instancias").expect(401);
    expect(service.listar).not.toHaveBeenCalled();
  });

  it("lista as instâncias do escritório", async () => {
    service.listar.mockResolvedValue([{ id: "instancia-1" }]);

    await request(await subir())
      .get("/api/instancias")
      .expect(200, { instancias: [{ id: "instancia-1" }] });
    expect(service.listar).toHaveBeenCalledWith(CTX_OWNER);
  });

  // Regressão herdada da rota Next: erro da UAZAPI no GET também é 502, não 500.
  it("responde 502 quando a UAZAPI está indisponível", async () => {
    service.listar.mockRejectedValue(new UazapiIndisponivelError());

    await request(await subir()).get("/api/instancias").expect(502, {
      error: "Não foi possível se comunicar com o WhatsApp no momento.",
    });
  });

  it("responde 500 genérico sem vazar detalhe interno", async () => {
    silenciarConsoleError();
    service.listar.mockRejectedValue(new Error("connection reset by peer"));

    await request(await subir()).get("/api/instancias").expect(500, ERRO_500);
  });
});

describe("POST /api/instancias", () => {
  const payloadValido = { nome: "Instância Principal" };

  it("cria e conecta a instância, respondendo 201", async () => {
    service.criarEConectar.mockResolvedValue({
      instancia: { id: "instancia-1" },
      qrcode: "qr-base64",
      paircode: "1234",
    });

    await request(await subir()).post("/api/instancias").send(payloadValido).expect(201, {
      instancia: { id: "instancia-1" },
      qrcode: "qr-base64",
      paircode: "1234",
    });
    expect(service.criarEConectar).toHaveBeenCalledWith(CTX_OWNER, { nome: "Instância Principal" });
  });

  it("omite qrcode/paircode quando a UAZAPI não devolve", async () => {
    service.criarEConectar.mockResolvedValue({ instancia: { id: "instancia-1" } });

    await request(await subir())
      .post("/api/instancias")
      .send(payloadValido)
      .expect(201, { instancia: { id: "instancia-1" } });
  });

  it("responde 400 com detalhes de campo quando o nome é vazio", async () => {
    const res = await request(await subir()).post("/api/instancias").send({ nome: "" }).expect(400);

    expect(res.body.error).toBe("Dados inválidos");
    expect(res.body.detalhes.nome).toBeDefined();
    expect(service.criarEConectar).not.toHaveBeenCalled();
  });

  it("responde 400 quando o body não é JSON", async () => {
    await request(await subir())
      .post("/api/instancias")
      .set("content-type", "application/json")
      .send("nao-e-json")
      .expect(400, { error: "Dados inválidos" });
    expect(service.criarEConectar).not.toHaveBeenCalled();
  });

  it("responde 403 quando o role não tem permissão de gestão", async () => {
    service.criarEConectar.mockRejectedValue(new PermissaoNegadaError());

    await request(await subir()).post("/api/instancias").send(payloadValido).expect(403, {
      error: "Você não tem permissão para executar esta ação.",
    });
  });

  it("responde 409 quando o nome já existe no escritório", async () => {
    service.criarEConectar.mockRejectedValue(new NomeInstanciaDuplicadoError(false));

    await request(await subir()).post("/api/instancias").send(payloadValido).expect(409, {
      error: "Já existe uma instância de WhatsApp com este nome neste escritório.",
    });
  });

  it("responde 502 quando a UAZAPI está indisponível", async () => {
    service.criarEConectar.mockRejectedValue(new UazapiIndisponivelError());

    await request(await subir()).post("/api/instancias").send(payloadValido).expect(502);
  });

  it("responde 500 genérico sem vazar detalhe interno", async () => {
    silenciarConsoleError();
    service.criarEConectar.mockRejectedValue(new Error("connection reset by peer"));

    await request(await subir()).post("/api/instancias").send(payloadValido).expect(500, ERRO_500);
  });
});

describe("POST /api/instancias/sincronizar", () => {
  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).post("/api/instancias/sincronizar").expect(401);
    expect(service.sincronizarTodas).not.toHaveBeenCalled();
  });

  it("sincroniza as instâncias do escritório e responde 200 (não 201)", async () => {
    service.sincronizarTodas.mockResolvedValue([{ id: "instancia-1", status: "connected" }]);

    await request(await subir())
      .post("/api/instancias/sincronizar")
      .expect(200, { instancias: [{ id: "instancia-1", status: "connected" }] });
    expect(service.sincronizarTodas).toHaveBeenCalledWith(CTX_OWNER);
  });

  it("responde 502 quando a UAZAPI está indisponível", async () => {
    service.sincronizarTodas.mockRejectedValue(new UazapiIndisponivelError());

    await request(await subir()).post("/api/instancias/sincronizar").expect(502);
  });

  it("responde 500 genérico sem vazar detalhe interno", async () => {
    silenciarConsoleError();
    service.sincronizarTodas.mockRejectedValue(new Error("connection reset by peer"));

    await request(await subir()).post("/api/instancias/sincronizar").expect(500, ERRO_500);
  });
});

describe("DELETE /api/instancias/:id", () => {
  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).delete("/api/instancias/instancia-1").expect(401);
    expect(service.excluir).not.toHaveBeenCalled();
  });

  it("exclui (soft delete, RN30) e responde { ok: true }", async () => {
    service.excluir.mockResolvedValue(undefined);

    await request(await subir()).delete("/api/instancias/instancia-1").expect(200, { ok: true });
    expect(service.excluir).toHaveBeenCalledWith(CTX_OWNER, "instancia-1");
  });

  it("responde 404 para instância de outro escritório", async () => {
    service.excluir.mockRejectedValue(new InstanciaWhatsappNaoEncontradaError());

    await request(await subir()).delete("/api/instancias/instancia-1").expect(404, {
      error: "Instância de WhatsApp não encontrada.",
    });
  });

  it("responde 403 quando o role não tem permissão de gestão", async () => {
    service.excluir.mockRejectedValue(new PermissaoNegadaError());

    await request(await subir()).delete("/api/instancias/instancia-1").expect(403);
  });

  it("responde 502 quando a UAZAPI está indisponível", async () => {
    service.excluir.mockRejectedValue(new UazapiIndisponivelError());

    await request(await subir()).delete("/api/instancias/instancia-1").expect(502);
  });

  it("responde 500 genérico sem vazar detalhe interno", async () => {
    silenciarConsoleError();
    service.excluir.mockRejectedValue(new Error("connection reset by peer"));

    await request(await subir()).delete("/api/instancias/instancia-1").expect(500, ERRO_500);
  });
});

describe("GET /api/instancias/:id/status", () => {
  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/instancias/instancia-1/status").expect(401);
    expect(service.verificarStatus).not.toHaveBeenCalled();
  });

  it("consulta o status da instância e responde 200", async () => {
    service.verificarStatus.mockResolvedValue({ id: "instancia-1", status: "conectado" });

    await request(await subir())
      .get("/api/instancias/instancia-1/status")
      .expect(200, { instancia: { id: "instancia-1", status: "conectado" } });
    expect(service.verificarStatus).toHaveBeenCalledWith(CTX_OWNER, "instancia-1");
  });

  it("responde 404 para instância de outro escritório", async () => {
    service.verificarStatus.mockRejectedValue(new InstanciaWhatsappNaoEncontradaError());

    await request(await subir()).get("/api/instancias/instancia-1/status").expect(404);
  });

  it("responde 502 quando a UAZAPI está indisponível", async () => {
    service.verificarStatus.mockRejectedValue(new UazapiIndisponivelError());

    await request(await subir()).get("/api/instancias/instancia-1/status").expect(502);
  });

  it("responde 500 genérico sem vazar detalhe interno", async () => {
    silenciarConsoleError();
    service.verificarStatus.mockRejectedValue(new Error("connection reset by peer"));

    await request(await subir()).get("/api/instancias/instancia-1/status").expect(500, ERRO_500);
  });
});

describe("POST /api/instancias/:id/desconectar", () => {
  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError()))
      .post("/api/instancias/instancia-1/desconectar")
      .expect(401);
    expect(service.desconectar).not.toHaveBeenCalled();
  });

  it("desconecta e responde 200 com o estado atualizado", async () => {
    service.desconectar.mockResolvedValue({ id: "instancia-1", status: "disconnected" });

    await request(await subir())
      .post("/api/instancias/instancia-1/desconectar")
      .expect(200, { instancia: { id: "instancia-1", status: "disconnected" } });
    expect(service.desconectar).toHaveBeenCalledWith(CTX_OWNER, "instancia-1");
  });

  it("responde 404 para instância de outro escritório", async () => {
    service.desconectar.mockRejectedValue(new InstanciaWhatsappNaoEncontradaError());

    await request(await subir()).post("/api/instancias/instancia-1/desconectar").expect(404);
  });

  it("responde 403 quando o role não tem permissão de gestão", async () => {
    service.desconectar.mockRejectedValue(new PermissaoNegadaError());

    await request(await subir()).post("/api/instancias/instancia-1/desconectar").expect(403);
  });

  it("responde 502 quando a UAZAPI está indisponível", async () => {
    service.desconectar.mockRejectedValue(new UazapiIndisponivelError());

    await request(await subir()).post("/api/instancias/instancia-1/desconectar").expect(502);
  });

  it("responde 500 genérico sem vazar detalhe interno", async () => {
    silenciarConsoleError();
    service.desconectar.mockRejectedValue(new Error("connection reset by peer"));

    await request(await subir()).post("/api/instancias/instancia-1/desconectar").expect(500, ERRO_500);
  });
});

describe("POST /api/instancias/:id/reconectar", () => {
  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError()))
      .post("/api/instancias/instancia-1/reconectar")
      .expect(401);
    expect(service.reconectar).not.toHaveBeenCalled();
  });

  it("reconecta e responde 200 com QR e paircode", async () => {
    service.reconectar.mockResolvedValue({
      instancia: { id: "instancia-1" },
      qrcode: "qr-base64",
      paircode: "1234",
    });

    await request(await subir()).post("/api/instancias/instancia-1/reconectar").expect(200, {
      instancia: { id: "instancia-1" },
      qrcode: "qr-base64",
      paircode: "1234",
    });
    expect(service.reconectar).toHaveBeenCalledWith(CTX_OWNER, "instancia-1");
  });

  it("responde 404 para instância de outro escritório", async () => {
    service.reconectar.mockRejectedValue(new InstanciaWhatsappNaoEncontradaError());

    await request(await subir()).post("/api/instancias/instancia-1/reconectar").expect(404);
  });

  it("responde 403 quando o role não tem permissão de gestão", async () => {
    service.reconectar.mockRejectedValue(new PermissaoNegadaError());

    await request(await subir()).post("/api/instancias/instancia-1/reconectar").expect(403);
  });

  it("responde 502 quando a UAZAPI está indisponível", async () => {
    service.reconectar.mockRejectedValue(new UazapiIndisponivelError());

    await request(await subir()).post("/api/instancias/instancia-1/reconectar").expect(502);
  });

  it("responde 500 genérico sem vazar detalhe interno", async () => {
    silenciarConsoleError();
    service.reconectar.mockRejectedValue(new Error("connection reset by peer"));

    await request(await subir()).post("/api/instancias/instancia-1/reconectar").expect(500, ERRO_500);
  });
});
