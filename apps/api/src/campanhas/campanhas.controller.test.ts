import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { criarAppDeTeste, CTX_OWNER } from "../../test/utils";
import { CampanhasModule } from "./campanhas.module";
import { CAMPANHAS_SERVICE } from "./tokens";
import {
  CampanhaNaoEncontradaError,
  CampanhaSemInstanciaError,
  DestinatariosInvalidosError,
  InstanciaNaoConectadaError,
  PermissaoNegadaError,
  VariavelSemColunaError,
} from "@dominio/services/campanha.service";
import { InstanciaWhatsappNaoEncontradaError } from "@dominio/services/instancia-whatsapp.service";
import { UazapiIndisponivelError } from "@dominio/lib/external/uazapi-client";
import { NaoAutenticadoError } from "@dominio/lib/auth/resolver-tenant";

const ERRO_500 = { error: "Não foi possível concluir a operação." };

const CORPO_VALIDO = {
  nome: "Campanha de teste",
  instanciaId: "3f2c1b7e-9a4d-4c8b-9f1e-2d3a4b5c6d7e",
  mensagemTemplate: "Olá {{nome}}",
  colunaNumero: "numero",
  mapeamentoVariaveis: { nome: { coluna: "Nome", tratamentos: [] } },
  delayMin: 3,
  delayMax: 6,
  linhas: [{ Nome: "Ana", numero: "5511999999999" }],
};

// Entidade como o service devolve (Dates, instância reduzida); a resposta HTTP é ela
// passada por serializarCampanha — o mesmo DTO que o evento de tempo real carrega.
const CAMPANHA = {
  id: "campanha-1",
  escritorioId: "esc-1",
  instanciaWhatsappId: "instancia-1",
  criadoPorId: "user-1",
  nome: "Campanha de teste",
  mensagemTemplate: "Olá {{nome}}",
  mapeamentoVariaveis: { nome: { coluna: "Nome", tratamentos: [] } },
  colunaNumero: "numero",
  arquivoCsvNome: null,
  delayMin: 3,
  delayMax: 6,
  agendadaPara: null,
  status: "enviando",
  uazapiFolderId: "folder-1",
  totalDestinatarios: 1,
  logTotal: 1,
  logSucesso: 0,
  logFalha: 0,
  logEntregue: 0,
  logLido: 0,
  logReproduzido: 0,
  sincronizadoEm: new Date("2026-01-01T00:05:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:05:00.000Z"),
  instancia: { id: "instancia-1", nome: "Atendimento", status: "connected", softDeletedAt: null },
};
const DTO = JSON.parse(JSON.stringify(CAMPANHA));

const service = {
  listar: jest.fn(),
  criar: jest.fn(),
  obter: jest.fn(),
  listarItens: jest.fn(),
  listarMensagens: jest.fn(),
  sincronizar: jest.fn(),
  controlar: jest.fn(),
};

let app: INestApplication;

async function subir(ctx?: Parameters<typeof criarAppDeTeste>[0]["ctx"]) {
  app = await criarAppDeTeste({
    imports: [CampanhasModule],
    ctx,
    overrides: [[CAMPANHAS_SERVICE, service]],
  });
  return app.getHttpServer();
}

afterEach(async () => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  await app?.close();
});

describe("GET /api/campanhas", () => {
  it("responde 401 sem sessão e não chama o service (RN19)", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/campanhas").expect(401);
    expect(service.listar).not.toHaveBeenCalled();
  });

  it("lista as campanhas do escritório da sessão", async () => {
    service.listar.mockResolvedValue([CAMPANHA]);

    await request(await subir()).get("/api/campanhas").expect(200, { campanhas: [DTO] });
    expect(service.listar).toHaveBeenCalledWith(CTX_OWNER);
  });

  // A resposta passa por serializarCampanha: campos explícitos, nunca a entidade crua.
  it("nunca devolve o uazapiToken, mesmo se a instância vier inteira do service", async () => {
    service.listar.mockResolvedValue([
      { ...CAMPANHA, instancia: { ...CAMPANHA.instancia, uazapiToken: "token-secreto" } },
    ]);

    const res = await request(await subir()).get("/api/campanhas").expect(200, { campanhas: [DTO] });
    expect(JSON.stringify(res.body)).not.toContain("token-secreto");
  });

  it("responde 500 genérico quando o service quebra por motivo inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.listar.mockRejectedValue(new Error("boom"));

    await request(await subir()).get("/api/campanhas").expect(500, ERRO_500);
  });
});

describe("POST /api/campanhas", () => {
  it("cria a campanha e responde 201", async () => {
    service.criar.mockResolvedValue(CAMPANHA);

    await request(await subir()).post("/api/campanhas").send(CORPO_VALIDO).expect(201, {
      campanha: DTO,
    });
    expect(service.criar).toHaveBeenCalledWith(CTX_OWNER, CORPO_VALIDO);
  });

  it("converte agendadaPara de ISO para Date antes de chamar o service", async () => {
    service.criar.mockResolvedValue(CAMPANHA);
    // Relativo ao agora: o schema recusa agendamento no passado.
    const daquiADuasHoras = new Date(Date.now() + 2 * 60 * 60 * 1000);

    await request(await subir())
      .post("/api/campanhas")
      .send({ ...CORPO_VALIDO, agendadaPara: daquiADuasHoras.toISOString() })
      .expect(201);

    expect(service.criar).toHaveBeenCalledWith(
      CTX_OWNER,
      expect.objectContaining({ agendadaPara: daquiADuasHoras })
    );
  });

  it("não repassa agendadaPara quando o corpo não traz agendamento", async () => {
    service.criar.mockResolvedValue(CAMPANHA);

    await request(await subir()).post("/api/campanhas").send(CORPO_VALIDO).expect(201);

    expect(service.criar.mock.calls[0][1]).not.toHaveProperty("agendadaPara");
  });

  it("recusa agendamento no passado", async () => {
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await request(await subir())
      .post("/api/campanhas")
      .send({ ...CORPO_VALIDO, agendadaPara: ontem.toISOString() })
      .expect(400);
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("responde 400 com body malformado", async () => {
    await request(await subir())
      .post("/api/campanhas")
      .set("content-type", "application/json")
      .send("{nao-e-json")
      .expect(400, { error: "Dados inválidos" });
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("responde 400 com detalhes quando falta campo obrigatório", async () => {
    const { nome: _nome, ...semNome } = CORPO_VALIDO;

    const res = await request(await subir()).post("/api/campanhas").send(semNome).expect(400);

    expect(res.body.detalhes.nome).toBeDefined();
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("responde 400 quando delayMax é menor que delayMin", async () => {
    const res = await request(await subir())
      .post("/api/campanhas")
      .send({ ...CORPO_VALIDO, delayMin: 10, delayMax: 2 })
      .expect(400);

    expect(res.body.detalhes.delayMax).toBeDefined();
  });

  it("responde 400 quando a lista de destinatários vem vazia", async () => {
    await request(await subir()).post("/api/campanhas").send({ ...CORPO_VALIDO, linhas: [] }).expect(400);
  });

  // Depende da Task 2.41: o CSV inteiro trafega no corpo.
  it("aceita a planilha no teto de 5000 destinatários", async () => {
    service.criar.mockResolvedValue(CAMPANHA);
    const linhas = Array.from({ length: 5000 }, (_, i) => ({
      Nome: `Destinatário número ${i}`,
      numero: "5511999999999",
      Cidade: "Joinville",
    }));

    await request(await subir()).post("/api/campanhas").send({ ...CORPO_VALIDO, linhas }).expect(201);
    expect(service.criar.mock.calls[0][1].linhas).toHaveLength(5000);
  });

  it.each([
    ["403", new PermissaoNegadaError(), 403],
    ["404 instância de outro escritório", new InstanciaWhatsappNaoEncontradaError(), 404],
    ["409 instância desconectada", new InstanciaNaoConectadaError(), 409],
    ["400 variável sem coluna", new VariavelSemColunaError(["nome"]), 400],
    ["400 número inválido na planilha", new DestinatariosInvalidosError("linha 2"), 400],
    ["502 UAZAPI indisponível", new UazapiIndisponivelError(), 502],
  ])("responde %s", async (_rotulo, erro, status) => {
    service.criar.mockRejectedValue(erro);

    await request(await subir())
      .post("/api/campanhas")
      .send(CORPO_VALIDO)
      .expect(status, { error: (erro as Error).message });
  });
});

describe("GET /api/campanhas/:id", () => {
  beforeEach(() => {
    service.obter.mockResolvedValue(CAMPANHA);
    service.listarItens.mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 50 });
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/campanhas/campanha-1").expect(401);
  });

  it("devolve a campanha junto da primeira página de itens", async () => {
    await request(await subir()).get("/api/campanhas/campanha-1").expect(200, {
      campanha: DTO,
      itens: [],
      total: 0,
      pagina: 1,
      porPagina: 50,
    });
    expect(service.obter).toHaveBeenCalledWith(CTX_OWNER, "campanha-1");
    expect(service.listarItens).toHaveBeenCalledWith(CTX_OWNER, "campanha-1", { pagina: 1 });
  });

  it("respeita ?pagina=", async () => {
    await request(await subir()).get("/api/campanhas/campanha-1?pagina=3").expect(200);

    expect(service.listarItens).toHaveBeenCalledWith(CTX_OWNER, "campanha-1", { pagina: 3 });
  });

  it.each(["abc", "0", "-2"])("trata ?pagina=%s como primeira página", async (pagina) => {
    await request(await subir()).get(`/api/campanhas/campanha-1?pagina=${pagina}`).expect(200);

    expect(service.listarItens).toHaveBeenCalledWith(CTX_OWNER, "campanha-1", { pagina: 1 });
  });

  it("responde 404 para campanha de outro escritório sem listar itens", async () => {
    service.obter.mockRejectedValue(new CampanhaNaoEncontradaError());

    await request(await subir()).get("/api/campanhas/campanha-1").expect(404, {
      error: "Campanha não encontrada.",
    });
    expect(service.listarItens).not.toHaveBeenCalled();
  });
});

describe("GET /api/campanhas/:id/mensagens", () => {
  beforeEach(() => {
    service.listarMensagens.mockResolvedValue({
      mensagens: [{ numero: "5511999998888", status: "enviada", erro: null, enviadaEm: new Date(0) }],
      total: 1,
      truncado: false,
    });
  });

  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).get("/api/campanhas/campanha-1/mensagens").expect(401);
  });

  it("devolve as mensagens com datas serializadas em ISO", async () => {
    await request(await subir()).get("/api/campanhas/campanha-1/mensagens").expect(200, {
      mensagens: [
        { numero: "5511999998888", status: "enviada", erro: null, enviadaEm: "1970-01-01T00:00:00.000Z" },
      ],
      total: 1,
      truncado: false,
    });
    expect(service.listarMensagens).toHaveBeenCalledWith(CTX_OWNER, "campanha-1", { pagina: 1 });
  });

  it("repassa a página pedida ao service", async () => {
    await request(await subir()).get("/api/campanhas/campanha-1/mensagens?pagina=3").expect(200);

    expect(service.listarMensagens).toHaveBeenCalledWith(CTX_OWNER, "campanha-1", { pagina: 3 });
  });

  it.each(["abc", "0", "-2"])("trata ?pagina=%s como primeira página", async (pagina) => {
    await request(await subir()).get(`/api/campanhas/campanha-1/mensagens?pagina=${pagina}`).expect(200);

    expect(service.listarMensagens).toHaveBeenCalledWith(CTX_OWNER, "campanha-1", { pagina: 1 });
  });

  it.each([
    ["404 campanha de outro escritório", new CampanhaNaoEncontradaError(), 404],
    ["409 instância não existe mais", new CampanhaSemInstanciaError(), 409],
    ["502 UAZAPI indisponível", new UazapiIndisponivelError(), 502],
  ])("responde %s", async (_rotulo, erro, status) => {
    service.listarMensagens.mockRejectedValue(erro);

    await request(await subir()).get("/api/campanhas/campanha-1/mensagens").expect(status);
  });

  it("responde 500 genérico em erro inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.listarMensagens.mockRejectedValue(new Error("boom"));

    await request(await subir()).get("/api/campanhas/campanha-1/mensagens").expect(500, ERRO_500);
  });
});

describe("POST /api/campanhas/:id/sincronizar", () => {
  it("responde 401 sem sessão", async () => {
    await request(await subir(new NaoAutenticadoError())).post("/api/campanhas/campanha-1/sincronizar").expect(401);
    expect(service.sincronizar).not.toHaveBeenCalled();
  });

  it("devolve a campanha atualizada com 200 (não 201)", async () => {
    service.sincronizar.mockResolvedValue({ ...CAMPANHA, logSucesso: 7 });

    await request(await subir())
      .post("/api/campanhas/campanha-1/sincronizar")
      .expect(200, { campanha: { ...DTO, logSucesso: 7 } });
    expect(service.sincronizar).toHaveBeenCalledWith(CTX_OWNER, "campanha-1");
  });

  it.each([
    ["404", new CampanhaNaoEncontradaError(), 404],
    ["502", new UazapiIndisponivelError(), 502],
  ])("responde %s", async (_rotulo, erro, status) => {
    service.sincronizar.mockRejectedValue(erro);

    await request(await subir()).post("/api/campanhas/campanha-1/sincronizar").expect(status);
  });
});

describe("POST /api/campanhas/:id/controlar", () => {
  beforeEach(() => {
    service.controlar.mockResolvedValue(CAMPANHA);
  });

  it("repassa a ação ao service e responde 200", async () => {
    await request(await subir())
      .post("/api/campanhas/campanha-1/controlar")
      .send({ acao: "stop" })
      .expect(200, { campanha: DTO });
    expect(service.controlar).toHaveBeenCalledWith(CTX_OWNER, "campanha-1", "stop");
  });

  // Depois de excluir não sobra linha local; o client usa isso para tirar a campanha da lista.
  it("devolve campanha null quando a ação foi delete", async () => {
    service.controlar.mockResolvedValue(null);

    await request(await subir())
      .post("/api/campanhas/campanha-1/controlar")
      .send({ acao: "delete" })
      .expect(200, { campanha: null });
  });

  it("responde 400 para ação desconhecida", async () => {
    const res = await request(await subir())
      .post("/api/campanhas/campanha-1/controlar")
      .send({ acao: "explodir" })
      .expect(400);

    expect(res.body.detalhes.acao).toEqual(["Ação inválida."]);
    expect(service.controlar).not.toHaveBeenCalled();
  });

  it("responde 400 com body malformado", async () => {
    await request(await subir())
      .post("/api/campanhas/campanha-1/controlar")
      .set("content-type", "application/json")
      .send("{nao-e-json")
      .expect(400, { error: "Dados inválidos" });
    expect(service.controlar).not.toHaveBeenCalled();
  });

  it.each([
    ["403 sem permissão de gestão", new PermissaoNegadaError(), 403],
    ["409 campanha perdeu a instância", new CampanhaSemInstanciaError(), 409],
    ["502 UAZAPI recusou a ação", new UazapiIndisponivelError(), 502],
  ])("responde %s", async (_rotulo, erro, status) => {
    service.controlar.mockRejectedValue(erro);

    await request(await subir())
      .post("/api/campanhas/campanha-1/controlar")
      .send({ acao: "continue" })
      .expect(status);
  });
});
