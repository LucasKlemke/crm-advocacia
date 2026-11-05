import { Readable } from "node:stream";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { ClientesModule } from "./clientes.module";
import { CLIENTE_SERVICE } from "./tokens";
import { DOCUMENTO_SERVICE, ZIP_DOCUMENTOS } from "../comum/tokens-documentos";
import {
  ClienteNaoEncontradoError,
  CpfDuplicadoError,
  CpfInvalidoError,
} from "@/services/cliente.service";
import { NaoAutenticadoError, SemEscritorioAtivoError } from "@/lib/auth/resolver-tenant";

const CPF = "529.982.247-25";
const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

const service = {
  listar: jest.fn(),
  obter: jest.fn(),
  criar: jest.fn(),
  atualizar: jest.fn(),
  desativarEmLote: jest.fn(),
  restaurarEmLote: jest.fn(),
};
const documentos = { listarPorEscopo: jest.fn() };
const montarZip = jest.fn();

let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({
    imports: [ClientesModule],
    ctx,
    overrides: [
      [CLIENTE_SERVICE, service],
      [DOCUMENTO_SERVICE, documentos],
      [ZIP_DOCUMENTOS, montarZip],
    ],
  });
  return app.getHttpServer();
}

afterEach(async () => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  await app?.close();
});

describe("GET /api/clientes", () => {
  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/clientes").expect(401);
    expect(service.listar).not.toHaveBeenCalled();
  });

  it("responde 409 sem escritório ativo", async () => {
    await request(await subir(new SemEscritorioAtivoError())).get("/api/clientes").expect(409);
  });

  it("repassa busca e paginação ao service e devolve os metadados", async () => {
    service.listar.mockResolvedValue({ clientes: [{ id: "cli-1" }], total: 41 });

    await request(await subir())
      .get("/api/clientes?busca=maria&pagina=3&incluirExcluidos=true")
      .expect(200, { clientes: [{ id: "cli-1" }], total: 41, pagina: 3, porPagina: 20 });
    expect(service.listar).toHaveBeenCalledWith(CTX_OWNER, {
      busca: "maria",
      incluirExcluidos: true,
      skip: 40,
      take: 20,
    });
  });

  it("sem query: página 1, sem busca, sem excluídos", async () => {
    service.listar.mockResolvedValue({ clientes: [], total: 0 });

    await request(await subir()).get("/api/clientes").expect(200);
    expect(service.listar).toHaveBeenCalledWith(CTX_OWNER, {
      busca: undefined,
      incluirExcluidos: false,
      skip: 0,
      take: 20,
    });
  });

  // Página inválida vinda da URL não pode virar skip negativo no banco.
  it("normaliza página inválida para a primeira", async () => {
    service.listar.mockResolvedValue({ clientes: [], total: 0 });

    await request(await subir()).get("/api/clientes?pagina=-5").expect(200);
    expect(service.listar).toHaveBeenCalledWith(CTX_OWNER, expect.objectContaining({ skip: 0 }));
  });
});

describe("POST /api/clientes", () => {
  it("cria o cliente e responde 201", async () => {
    service.criar.mockResolvedValue({ id: "cli-1" });

    await request(await subir())
      .post("/api/clientes")
      .send({ nome: "Maria Silva", cpf: CPF })
      .expect(201, { cliente: { id: "cli-1" } });
    expect(service.criar).toHaveBeenCalledWith(CTX_OWNER, expect.objectContaining({ nome: "Maria Silva" }));
  });

  it.each([
    ["nome curto", { nome: "Ma", cpf: CPF }, "nome"],
    ["CPF com dígito errado", { nome: "Maria Silva", cpf: "123456789" }, "cpf"],
    ["telefone incompleto", { nome: "Maria Silva", cpf: CPF, telefone: "47999998888" }, "telefone"],
    ["e-mail malformado", { nome: "Maria Silva", cpf: CPF, email: "mariasilvateste" }, "email"],
  ])("responde 400 com detalhes por campo (%s)", async (_caso, corpo, campo) => {
    const res = await request(await subir()).post("/api/clientes").send(corpo).expect(400);

    expect(res.body.error).toBe("Dados inválidos");
    expect(res.body.detalhes[campo]).toBeDefined();
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("aceita telefone e e-mail válidos", async () => {
    service.criar.mockResolvedValue({ id: "cli-1" });

    await request(await subir())
      .post("/api/clientes")
      .send({
        nome: "Maria Silva",
        cpf: CPF,
        telefone: "+55 (47) 99999-8888",
        email: "maria.silva@exemplo.com",
      })
      .expect(201);
  });

  it("responde 400 quando o body não é JSON", async () => {
    await request(await subir())
      .post("/api/clientes")
      .set("content-type", "application/json")
      .send("nao-e-json")
      .expect(400, { error: "Dados inválidos" });
  });

  it("responde 409 quando o CPF já existe no escritório (RN05)", async () => {
    service.criar.mockRejectedValue(new CpfDuplicadoError(false));

    await request(await subir()).post("/api/clientes").send({ nome: "Maria Silva", cpf: CPF }).expect(409, {
      error: "Já existe um cliente com este CPF neste escritório.",
    });
  });

  it("responde 400 quando o service recusa o CPF", async () => {
    service.criar.mockRejectedValue(new CpfInvalidoError());

    await request(await subir()).post("/api/clientes").send({ nome: "Maria Silva", cpf: CPF }).expect(400, {
      error: "CPF inválido.",
    });
  });

  it("responde 500 sem vazar detalhe interno em erro inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.criar.mockRejectedValue(new Error("connection reset by peer"));

    await request(await subir())
      .post("/api/clientes")
      .send({ nome: "Maria Silva", cpf: CPF })
      .expect(500, { error: "Não foi possível concluir a operação." });
  });
});

describe("POST /api/clientes/lote", () => {
  it("desativa os clientes selecionados e responde 200", async () => {
    service.desativarEmLote.mockResolvedValue({ desativados: 2, ignorados: 0 });

    await request(await subir())
      .post("/api/clientes/lote")
      .send({ ids: [ID_A, ID_B], acao: "desativar" })
      .expect(200, { desativados: 2, ignorados: 0 });
    expect(service.desativarEmLote).toHaveBeenCalledWith(CTX_OWNER, [ID_A, ID_B]);
  });

  it("restaura quando a ação é restaurar", async () => {
    service.restaurarEmLote.mockResolvedValue({ restaurados: 1, ignorados: 0 });

    await request(await subir())
      .post("/api/clientes/lote")
      .send({ ids: [ID_A], acao: "restaurar" })
      .expect(200, { restaurados: 1, ignorados: 0 });
    expect(service.restaurarEmLote).toHaveBeenCalledWith(CTX_OWNER, [ID_A]);
    expect(service.desativarEmLote).not.toHaveBeenCalled();
  });

  it.each([
    ["lista vazia", { ids: [], acao: "desativar" }],
    ["ação desconhecida", { ids: [ID_A], acao: "excluir-de-vez" }],
    ["id que não é uuid", { ids: ["'; drop table cliente; --"], acao: "desativar" }],
  ])("recusa %s com 400", async (_caso, corpo) => {
    await request(await subir()).post("/api/clientes/lote").send(corpo).expect(400);
    expect(service.desativarEmLote).not.toHaveBeenCalled();
    expect(service.restaurarEmLote).not.toHaveBeenCalled();
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError()))
      .post("/api/clientes/lote")
      .send({ ids: [ID_A], acao: "desativar" })
      .expect(401);
  });
});

describe("GET /api/clientes/:id", () => {
  it("devolve o cliente do escritório", async () => {
    service.obter.mockResolvedValue({ id: "cli-1" });

    await request(await subir()).get("/api/clientes/cli-1").expect(200, { cliente: { id: "cli-1" } });
    expect(service.obter).toHaveBeenCalledWith(CTX_OWNER, "cli-1");
  });

  // RN19: cliente de outro tenant responde 404, nunca 403 — não confirma que existe.
  it("responde 404 para cliente de outro escritório", async () => {
    service.obter.mockRejectedValue(new ClienteNaoEncontradoError());

    await request(await subir()).get("/api/clientes/cli-1").expect(404, { error: "Cliente não encontrado." });
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/clientes/cli-1").expect(401);
  });
});

describe("PATCH /api/clientes/:id", () => {
  it("atualiza apenas os campos enviados", async () => {
    service.atualizar.mockResolvedValue({ id: "cli-1" });

    await request(await subir())
      .patch("/api/clientes/cli-1")
      .send({ telefone: "5548988887777" })
      .expect(200, { cliente: { id: "cli-1" } });
    expect(service.atualizar).toHaveBeenCalledWith(CTX_OWNER, "cli-1", { telefone: "5548988887777" });
  });

  it("aceita null para limpar um campo opcional", async () => {
    service.atualizar.mockResolvedValue({ id: "cli-1" });

    await request(await subir()).patch("/api/clientes/cli-1").send({ telefone: null }).expect(200);
    expect(service.atualizar).toHaveBeenCalledWith(CTX_OWNER, "cli-1", { telefone: null });
  });

  it("responde 400 com detalhes quando o nome é curto demais", async () => {
    const res = await request(await subir()).patch("/api/clientes/cli-1").send({ nome: "Ma" }).expect(400);
    expect(res.body.detalhes.nome).toBeDefined();
  });

  it("responde 409 em colisão de CPF", async () => {
    service.atualizar.mockRejectedValue(new CpfDuplicadoError(true));

    await request(await subir()).patch("/api/clientes/cli-1").send({ cpf: CPF }).expect(409);
  });
});

describe("GET /api/clientes/:id/documentos/download-todos", () => {
  it("devolve um stream zip com o nome do cliente no filename", async () => {
    service.obter.mockResolvedValue({ id: "cli-1", nome: "Maria Silva" });
    documentos.listarPorEscopo.mockResolvedValue([{ id: "doc-1" }]);
    montarZip.mockReturnValue(Readable.from([Buffer.from("PK\x03\x04")]));

    const res = await request(await subir())
      .get("/api/clientes/cli-1/documentos/download-todos")
      .responseType("blob")
      .expect(200);

    expect(res.headers["content-type"]).toBe("application/zip");
    expect(res.headers["content-disposition"]).toBe(
      'attachment; filename="documentos-cliente-Maria Silva.zip"'
    );
    expect(Buffer.from(res.body).toString("latin1")).toBe("PK\x03\x04");
    expect(documentos.listarPorEscopo).toHaveBeenCalledWith(CTX_OWNER, "cliente", "cli-1");
    expect(montarZip).toHaveBeenCalledWith([{ id: "doc-1" }]);
  });

  it("mapeia ClienteNaoEncontradoError para 404 e não monta zip", async () => {
    service.obter.mockRejectedValue(new ClienteNaoEncontradoError());

    await request(await subir())
      .get("/api/clientes/cli-alheio/documentos/download-todos")
      .expect(404, { error: "Cliente não encontrado." });
    expect(montarZip).not.toHaveBeenCalled();
  });

  it("responde 502 quando falha ao listar os documentos", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.obter.mockResolvedValue({ id: "cli-1", nome: "Maria Silva" });
    documentos.listarPorEscopo.mockRejectedValue(new Error("timeout"));

    await request(await subir())
      .get("/api/clientes/cli-1/documentos/download-todos")
      .expect(502, { error: "Não foi possível gerar o arquivo zip." });
  });

  // A resposta já saiu com 200 quando o stream começa: erro interno do archiver não pode
  // desaparecer em silêncio — o pipeline do responderZip registra um listener de erro.
  it("registra listener de erro no stream do zip", async () => {
    service.obter.mockResolvedValue({ id: "cli-1", nome: "Maria Silva" });
    documentos.listarPorEscopo.mockResolvedValue([]);
    const zip = Readable.from([Buffer.from("PK\x03\x04")]);
    const espiaOn = jest.spyOn(zip, "on");
    montarZip.mockReturnValue(zip);

    await request(await subir()).get("/api/clientes/cli-1/documentos/download-todos").expect(200);
    expect(espiaOn).toHaveBeenCalledWith("error", expect.any(Function));
  });
});
