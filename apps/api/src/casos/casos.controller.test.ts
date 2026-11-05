import { Readable } from "node:stream";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { CasosModule } from "./casos.module";
import { CASO_SERVICE, PAYLOADS_CASO } from "./tokens";
import { DOCUMENTO_SERVICE, ZIP_DOCUMENTOS } from "../comum/tokens-documentos";
import {
  CasoNaoEncontradoError,
  ClienteInativoError,
  ResponsavelInvalidoError,
} from "@/services/caso.service";
import { ClienteNaoEncontradoError } from "@/services/cliente.service";
import { NaoAutenticadoError } from "@/lib/auth/resolver-tenant";

// serializarCaso (chamado de verdade pelo controller) assina o avatar via usuarioService:
// o mock deixa verificar que o senhaHash não vaza e o avatar sai assinado.
jest.mock("@/services/usuario.service", () => ({
  usuarioService: { assinarUrlAvatar: jest.fn() },
}));
const { usuarioService } = jest.requireMock("@/services/usuario.service");

const CLIENTE_ID = "11111111-1111-4111-8111-111111111111";
const STATUS_ID = "22222222-2222-4222-8222-222222222222";
const TIPO_PROCESSO_ID = "44444444-4444-4444-8444-444444444444";
const CORPO_NOVO = { tipoProcessoId: TIPO_PROCESSO_ID, clienteId: CLIENTE_ID, statusId: STATUS_ID };

const RESPONSAVEL_COM_HASH = {
  id: "membro-1",
  usuario: {
    id: "user-1",
    nome: "Fulano",
    email: "fulano@teste.com",
    senhaHash: "hash-nunca-deveria-sair",
    avatarUrl: "development/avatares/user-1/foto.png",
  },
};

const service = {
  obter: jest.fn(),
  criar: jest.fn(),
  atualizar: jest.fn(),
  arquivar: jest.fn(),
  listarKanban: jest.fn(),
};
const payloads = { montarListaCasos: jest.fn(), montarOpcoesFiltroCaso: jest.fn() };
const documentos = { listarPorEscopo: jest.fn() };
const montarZip = jest.fn();

let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({
    imports: [CasosModule],
    ctx,
    overrides: [
      [CASO_SERVICE, service],
      [PAYLOADS_CASO, payloads],
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

describe("GET /api/casos", () => {
  it("monta a lista com os filtros da query e a página", async () => {
    payloads.montarListaCasos.mockResolvedValue({ casos: [], total: 0, pagina: 2, porPagina: 20 });

    await request(await subir())
      .get(`/api/casos?busca=cobran%C3%A7a&statusId=${STATUS_ID}&pagina=2`)
      .expect(200, { casos: [], total: 0, pagina: 2, porPagina: 20 });
    expect(payloads.montarListaCasos).toHaveBeenCalledWith(
      CTX_OWNER,
      expect.objectContaining({ busca: "cobrança", statusIds: [STATUS_ID], arquivado: false }),
      2
    );
  });

  it("repassa listas separadas por vírgula, sem-responsavel e arquivado", async () => {
    payloads.montarListaCasos.mockResolvedValue({ casos: [], total: 0, pagina: 1, porPagina: 20 });

    await request(await subir())
      .get("/api/casos?clienteId=a,b&responsavelId=sem-responsavel&arquivado=true&dataInicio=2026-01-01")
      .expect(200);
    expect(payloads.montarListaCasos).toHaveBeenCalledWith(
      CTX_OWNER,
      expect.objectContaining({
        clienteIds: ["a", "b"],
        responsavelIds: ["sem-responsavel"],
        arquivado: true,
        dataInicio: new Date("2026-01-01"),
      }),
      1
    );
  });

  it("normaliza página inválida para 1", async () => {
    payloads.montarListaCasos.mockResolvedValue({ casos: [], total: 0, pagina: 1, porPagina: 20 });

    await request(await subir()).get("/api/casos?pagina=-3").expect(200);
    expect(payloads.montarListaCasos).toHaveBeenCalledWith(CTX_OWNER, expect.any(Object), 1);
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/casos").expect(401);
    expect(payloads.montarListaCasos).not.toHaveBeenCalled();
  });

  it("responde 500 sem vazar detalhe interno em erro inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    payloads.montarListaCasos.mockRejectedValue(new Error("connection reset by peer"));

    await request(await subir())
      .get("/api/casos")
      .expect(500, { error: "Não foi possível concluir a operação." });
  });
});

describe("POST /api/casos", () => {
  it("cria o caso e responde 201 com o registro", async () => {
    service.criar.mockResolvedValue({ id: "caso-1" });

    await request(await subir()).post("/api/casos").send(CORPO_NOVO).expect(201, { caso: { id: "caso-1" } });
    expect(service.criar).toHaveBeenCalledWith(CTX_OWNER, expect.objectContaining(CORPO_NOVO));
  });

  it("responde 400 quando o body não é JSON", async () => {
    await request(await subir())
      .post("/api/casos")
      .set("content-type", "application/json")
      .send("nao-e-json")
      .expect(400, { error: "Dados inválidos" });
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("responde 400 com detalhes quando falta o tipo de processo (RN22)", async () => {
    const res = await request(await subir())
      .post("/api/casos")
      .send({ clienteId: CLIENTE_ID, statusId: STATUS_ID })
      .expect(400);
    expect(res.body.detalhes.tipoProcessoId).toBeDefined();
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("responde 404 quando o cliente não é do tenant (RN06)", async () => {
    service.criar.mockRejectedValue(new ClienteNaoEncontradoError());

    await request(await subir()).post("/api/casos").send(CORPO_NOVO).expect(404, {
      error: "Cliente não encontrado.",
    });
  });

  it("responde 400 quando o cliente está inativo", async () => {
    service.criar.mockRejectedValue(new ClienteInativoError());

    await request(await subir()).post("/api/casos").send(CORPO_NOVO).expect(400, {
      error: "Este cliente está inativo e não pode ser vinculado a um processo.",
    });
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).post("/api/casos").send(CORPO_NOVO).expect(401);
  });
});

describe("GET /api/casos/filtros", () => {
  it("devolve o payload de opções sem cair na rota :id", async () => {
    const opcoes = { clientes: [], membros: [], status: [], tipos: [], tiposProcesso: [] };
    payloads.montarOpcoesFiltroCaso.mockResolvedValue(opcoes);

    await request(await subir()).get("/api/casos/filtros").expect(200, opcoes);
    expect(payloads.montarOpcoesFiltroCaso).toHaveBeenCalledWith(CTX_OWNER);
    expect(service.obter).not.toHaveBeenCalled();
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/casos/filtros").expect(401);
  });
});

describe("GET /api/casos/kanban", () => {
  it("devolve as colunas montadas pelo service, sem cair na rota :id", async () => {
    const colunas = [{ status: { id: "status-1" }, total: 2, casos: [] }];
    service.listarKanban.mockResolvedValue(colunas);

    await request(await subir()).get("/api/casos/kanban?busca=cobran%C3%A7a").expect(200, { colunas });
    expect(service.listarKanban).toHaveBeenCalledWith(CTX_OWNER, expect.objectContaining({ busca: "cobrança" }));
    expect(service.obter).not.toHaveBeenCalled();
  });

  it("serializa os casos de cada coluna, sem vazar senhaHash e assinando o avatar", async () => {
    usuarioService.assinarUrlAvatar.mockResolvedValue("https://bucket.s3.amazonaws.com/signed-get");
    service.listarKanban.mockResolvedValue([
      { status: { id: "status-1" }, total: 1, casos: [{ id: "caso-1", responsavel: RESPONSAVEL_COM_HASH }] },
    ]);

    const res = await request(await subir()).get("/api/casos/kanban").expect(200);

    expect(JSON.stringify(res.body)).not.toContain("hash-nunca-deveria-sair");
    expect(res.body.colunas[0].casos[0].responsavel.usuario.avatarUrl).toBe(
      "https://bucket.s3.amazonaws.com/signed-get"
    );
  });

  it("repassa statusId da query — o kanban oculta colunas não selecionadas", async () => {
    service.listarKanban.mockResolvedValue([]);

    await request(await subir()).get("/api/casos/kanban?statusId=algum-id").expect(200, { colunas: [] });
    expect(service.listarKanban.mock.calls[0][1]).toEqual(expect.objectContaining({ statusIds: ["algum-id"] }));
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/casos/kanban").expect(401);
  });

  it("responde 500 sem vazar detalhe interno em erro inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.listarKanban.mockRejectedValue(new Error("connection reset by peer"));

    await request(await subir())
      .get("/api/casos/kanban")
      .expect(500, { error: "Não foi possível concluir a operação." });
  });
});

describe("GET /api/casos/:id", () => {
  it("devolve o caso", async () => {
    service.obter.mockResolvedValue({ id: "caso-1", responsavel: null });

    await request(await subir()).get("/api/casos/caso-1").expect(200, { caso: { id: "caso-1", responsavel: null } });
    expect(service.obter).toHaveBeenCalledWith(CTX_OWNER, "caso-1");
  });

  it("responde 404 quando o caso não é do tenant", async () => {
    service.obter.mockRejectedValue(new CasoNaoEncontradoError());

    await request(await subir()).get("/api/casos/caso-1").expect(404, { error: "Processo não encontrado." });
  });

  it("não vaza o senhaHash do responsável e assina o avatar", async () => {
    usuarioService.assinarUrlAvatar.mockResolvedValue("https://bucket.s3.amazonaws.com/signed-get");
    service.obter.mockResolvedValue({ id: "caso-1", responsavel: RESPONSAVEL_COM_HASH });

    const res = await request(await subir()).get("/api/casos/caso-1").expect(200);

    expect(JSON.stringify(res.body)).not.toContain("hash-nunca-deveria-sair");
    expect(res.body.caso.responsavel.usuario.avatarUrl).toBe("https://bucket.s3.amazonaws.com/signed-get");
  });
});

describe("PATCH /api/casos/:id", () => {
  it("atualiza o caso (inclusive troca de status via drag-and-drop)", async () => {
    service.atualizar.mockResolvedValue({ id: "caso-1", responsavel: null });

    await request(await subir()).patch("/api/casos/caso-1").send({ statusId: STATUS_ID }).expect(200);
    expect(service.atualizar).toHaveBeenCalledWith(CTX_OWNER, "caso-1", { statusId: STATUS_ID });
  });

  // A UI repinta o sheet e a tabela com o retorno do PATCH: precisa das relações.
  it("responde o caso com as relações serializadas, não o registro cru", async () => {
    service.atualizar.mockResolvedValue({
      id: "caso-1",
      tipoProcessoId: "tipo-processo-1",
      cliente: { id: "cli-1", nome: "Maria" },
      status: { id: "status-1", nome: "Em análise" },
      tipoProcesso: { id: "tipo-processo-1", nome: "Ação de cobrança" },
      responsavel: null,
    });

    const res = await request(await subir())
      .patch("/api/casos/caso-1")
      .send({ descricao: "Nova descrição" })
      .expect(200);

    expect(res.body.caso.tipoProcesso).toEqual({ id: "tipo-processo-1", nome: "Ação de cobrança" });
    expect(res.body.caso.cliente).toBeDefined();
    expect(res.body.caso.status).toBeDefined();
  });

  it("responde 400 para payload inválido", async () => {
    await request(await subir()).patch("/api/casos/caso-1").send({ tipoProcessoId: "nao-e-uuid" }).expect(400);
    expect(service.atualizar).not.toHaveBeenCalled();
  });

  it("responde 400 quando o responsável é inválido", async () => {
    service.atualizar.mockRejectedValue(new ResponsavelInvalidoError());

    await request(await subir())
      .patch("/api/casos/caso-1")
      .send({ responsavelMembroId: "33333333-3333-4333-8333-333333333333" })
      .expect(400, { error: "Responsável inválido para este escritório." });
  });

  it("responde 404 quando o caso não é do tenant", async () => {
    service.atualizar.mockRejectedValue(new CasoNaoEncontradoError());

    await request(await subir()).patch("/api/casos/caso-1").send({ descricao: "x" }).expect(404);
  });
});

describe("DELETE /api/casos/:id", () => {
  it("arquiva (soft) e responde 200 com o caso serializado (RN08)", async () => {
    service.arquivar.mockResolvedValue({
      id: "caso-1",
      arquivado: true,
      tipoProcesso: { id: "tipo-processo-1", nome: "Ação de cobrança" },
      responsavel: null,
    });

    const res = await request(await subir()).delete("/api/casos/caso-1").expect(200);

    expect(res.body.caso.tipoProcesso.nome).toBe("Ação de cobrança");
    expect(service.arquivar).toHaveBeenCalledWith(CTX_OWNER, "caso-1");
  });

  it("responde 404 quando o caso não é do tenant", async () => {
    service.arquivar.mockRejectedValue(new CasoNaoEncontradoError());

    await request(await subir()).delete("/api/casos/caso-1").expect(404);
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).delete("/api/casos/caso-1").expect(401);
    expect(service.arquivar).not.toHaveBeenCalled();
  });
});

describe("GET /api/casos/:id/documentos/download-todos", () => {
  it("devolve um stream zip com o tipo de processo no filename", async () => {
    service.obter.mockResolvedValue({ id: "caso-1", tipoProcesso: { nome: "Ação de Cobrança" } });
    documentos.listarPorEscopo.mockResolvedValue([{ id: "doc-1" }]);
    montarZip.mockReturnValue(Readable.from([Buffer.from("PK\x03\x04")]));

    const res = await request(await subir())
      .get("/api/casos/caso-1/documentos/download-todos")
      .responseType("blob")
      .expect(200);

    expect(res.headers["content-type"]).toBe("application/zip");
    expect(res.headers["content-disposition"]).toBe(
      'attachment; filename="documentos-caso-Ação de Cobrança.zip"'
    );
    expect(documentos.listarPorEscopo).toHaveBeenCalledWith(CTX_OWNER, "caso", "caso-1");
  });

  it("mapeia CasoNaoEncontradoError para 404", async () => {
    service.obter.mockRejectedValue(new CasoNaoEncontradoError());

    await request(await subir()).get("/api/casos/caso-alheio/documentos/download-todos").expect(404);
    expect(montarZip).not.toHaveBeenCalled();
  });

  it("responde 502 em erro inesperado antes do stream", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.obter.mockResolvedValue({ id: "caso-1", tipoProcesso: { nome: "X" } });
    documentos.listarPorEscopo.mockRejectedValue(new Error("timeout"));

    await request(await subir())
      .get("/api/casos/caso-1/documentos/download-todos")
      .expect(502, { error: "Não foi possível gerar o arquivo zip." });
  });

  it("registra listener de erro no stream do zip", async () => {
    service.obter.mockResolvedValue({ id: "caso-1", tipoProcesso: { nome: "X" } });
    documentos.listarPorEscopo.mockResolvedValue([]);
    const zip = Readable.from([Buffer.from("PK\x03\x04")]);
    const espiaOn = jest.spyOn(zip, "on");
    montarZip.mockReturnValue(zip);

    await request(await subir()).get("/api/casos/caso-1/documentos/download-todos").expect(200);
    expect(espiaOn).toHaveBeenCalledWith("error", expect.any(Function));
  });
});
