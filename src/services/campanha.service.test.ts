import {
  campanhaService,
  CampanhaNaoEncontradaError,
  CampanhaSemInstanciaError,
  DestinatariosInvalidosError,
  InstanciaNaoConectadaError,
  PermissaoNegadaError,
  VariavelSemColunaError,
} from "./campanha.service";
import { campanhaRepository } from "@/repositories/campanha.repository";
import { campanhaItemRepository } from "@/repositories/campanha-item.repository";
import { instanciaWhatsappService } from "@/services/instancia-whatsapp.service";
import { uazapiClient, UazapiIndisponivelError } from "@/lib/external/uazapi-client";
import { logService } from "@/services/log.service";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { InstanciaWhatsapp } from "@prisma/client";
import type { CampanhaComInstancia } from "@/repositories/campanha.repository";

jest.mock("@/repositories/campanha.repository");
jest.mock("@/repositories/campanha-item.repository");
jest.mock("@/lib/external/uazapi-client");
jest.mock("@/services/log.service");
jest.mock("@/services/instancia-whatsapp.service", () => {
  const real = jest.requireActual("@/services/instancia-whatsapp.service");
  return {
    ...real,
    instanciaWhatsappService: { obterComToken: jest.fn() },
  };
});
jest.mock("@/lib/prisma", () => ({
  // A transação roda o callback direto: os repositórios já estão mockados.
  prisma: { $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({})) },
}));

const repo = campanhaRepository as jest.Mocked<typeof campanhaRepository>;
const itensRepo = campanhaItemRepository as jest.Mocked<typeof campanhaItemRepository>;
const instancias = instanciaWhatsappService as jest.Mocked<typeof instanciaWhatsappService>;
const client = uazapiClient as jest.Mocked<typeof uazapiClient>;
const logs = logService as jest.Mocked<typeof logService>;

function ctx(role: TenantContext["role"] = "owner"): TenantContext {
  return { usuarioId: "user-1", escritorioId: "esc-1", role };
}

function instanciaFake(over: Partial<InstanciaWhatsapp> = {}): InstanciaWhatsapp {
  return {
    id: "instancia-1",
    escritorioId: "esc-1",
    nome: "Atendimento",
    uazapiInstanceId: "uazapi-id-1",
    uazapiToken: "token-secreto",
    status: "connected",
    numeroConectado: "5511999999999",
    fotoPerfilUrl: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...over,
  };
}

function campanhaFake(over: Partial<CampanhaComInstancia> = {}): CampanhaComInstancia {
  return {
    id: "campanha-1",
    escritorioId: "esc-1",
    instanciaWhatsappId: "instancia-1",
    criadoPorId: "user-1",
    nome: "Campanha de teste",
    mensagemTemplate: "Olá {{nome}}",
    mapeamentoVariaveis: { nome: { coluna: "Nome", tratamentos: [] } },
    colunaNumero: "numero",
    arquivoCsvNome: "lista.csv",
    delayMin: 3,
    delayMax: 6,
    agendadaPara: null,
    status: "agendada",
    uazapiFolderId: "folder-1",
    totalDestinatarios: 2,
    logTotal: 0,
    logSucesso: 0,
    logFalha: 0,
    logEntregue: 0,
    logLido: 0,
    logReproduzido: 0,
    sincronizadoEm: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    instancia: { id: "instancia-1", nome: "Atendimento", status: "connected" },
    ...over,
  } as CampanhaComInstancia;
}

const DADOS = {
  nome: "Campanha de teste",
  instanciaId: "instancia-1",
  mensagemTemplate: "Olá {{nome}}, tudo bem?",
  colunaNumero: "numero",
  mapeamentoVariaveis: { nome: { coluna: "Nome", tratamentos: [] } },
  delayMin: 3,
  delayMax: 6,
  linhas: [
    { Nome: "Ana", numero: "5511999999999" },
    { Nome: "Bruno", numero: "+55 (11) 98888-8888" },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  logs.registrar.mockResolvedValue({} as never);
  instancias.obterComToken.mockResolvedValue(instanciaFake());
  client.criarEnvioAvancado.mockResolvedValue({
    folderId: "folder-1",
    count: 2,
    status: "queued",
  });
  repo.create.mockImplementation(async (data) => ({ id: "campanha-1", ...data }) as never);
  itensRepo.createMany.mockResolvedValue(2);
});

describe("campanhaService.criar", () => {
  it("rejeita role padrao sem tocar repository ou UAZAPI", async () => {
    await expect(campanhaService.criar(ctx("padrao"), DADOS)).rejects.toThrow(PermissaoNegadaError);

    expect(client.criarEnvioAvancado).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("envia uma mensagem renderizada por linha, com o número normalizado", async () => {
    await campanhaService.criar(ctx(), DADOS);

    expect(client.criarEnvioAvancado).toHaveBeenCalledWith(
      "token-secreto",
      expect.objectContaining({
        delayMin: 3,
        delayMax: 6,
        info: "Campanha de teste",
        messages: [
          { number: "5511999999999", type: "text", text: "Olá Ana, tudo bem?" },
          { number: "5511988888888", type: "text", text: "Olá Bruno, tudo bem?" },
        ],
      })
    );
  });

  it("grava o folder_id devolvido pela UAZAPI junto da campanha", async () => {
    await campanhaService.criar(ctx(), DADOS);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ uazapiFolderId: "folder-1", totalDestinatarios: 2 }),
      expect.anything()
    );
  });

  it("grava os itens já renderizados, numerados pela linha do CSV", async () => {
    await campanhaService.criar(ctx(), DADOS);

    expect(itensRepo.createMany).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          escritorioId: "esc-1",
          campanhaId: "campanha-1",
          linha: 1,
          numero: "5511999999999",
          mensagem: "Olá Ana, tudo bem?",
        }),
        expect.objectContaining({ linha: 2, numero: "5511988888888", mensagem: "Olá Bruno, tudo bem?" }),
      ],
      expect.anything()
    );
  });

  it("registra o log de criação na mesma transação (RN20)", async () => {
    await campanhaService.criar(ctx(), DADOS);

    expect(logs.registrar).toHaveBeenCalledWith(
      ctx(),
      expect.objectContaining({ acao: "criar", entidade: "campanha", entidadeId: "campanha-1" }),
      expect.anything()
    );
  });

  it("converte o agendamento para epoch em milissegundos", async () => {
    await campanhaService.criar(ctx(), {
      ...DADOS,
      agendadaPara: new Date("2026-03-01T12:00:00.000Z"),
    });

    expect(client.criarEnvioAvancado).toHaveBeenCalledWith(
      "token-secreto",
      expect.objectContaining({ scheduledFor: Date.parse("2026-03-01T12:00:00.000Z") })
    );
  });

  it("omite scheduled_for quando não há agendamento", async () => {
    await campanhaService.criar(ctx(), DADOS);

    const envio = client.criarEnvioAvancado.mock.calls[0][1];
    expect(envio.scheduledFor).toBeUndefined();
  });

  it("recusa instância que não está conectada", async () => {
    instancias.obterComToken.mockResolvedValue(instanciaFake({ status: "disconnected" }));

    await expect(campanhaService.criar(ctx(), DADOS)).rejects.toThrow(InstanciaNaoConectadaError);
    expect(client.criarEnvioAvancado).not.toHaveBeenCalled();
  });

  it("recusa variável do template sem coluna mapeada", async () => {
    await expect(
      campanhaService.criar(ctx(), { ...DADOS, mapeamentoVariaveis: {} })
    ).rejects.toThrow(VariavelSemColunaError);
    expect(client.criarEnvioAvancado).not.toHaveBeenCalled();
  });

  it("recusa mapeamento apontando para coluna inexistente no CSV", async () => {
    await expect(
      campanhaService.criar(ctx(), { ...DADOS, mapeamentoVariaveis: { nome: { coluna: "Apelido", tratamentos: [] } } })
    ).rejects.toThrow(VariavelSemColunaError);
  });

  it("recusa colunaNumero que não existe no CSV", async () => {
    await expect(
      campanhaService.criar(ctx(), { ...DADOS, colunaNumero: "celular" })
    ).rejects.toThrow(DestinatariosInvalidosError);
  });

  it("recusa a campanha inteira quando alguma linha tem número inválido, apontando a linha", async () => {
    const dados = {
      ...DADOS,
      linhas: [
        { Nome: "Ana", numero: "5511999999999" },
        { Nome: "Bruno", numero: "1234" },
      ],
    };

    await expect(campanhaService.criar(ctx(), dados)).rejects.toThrow(DestinatariosInvalidosError);
    await expect(campanhaService.criar(ctx(), dados)).rejects.toThrow(/linha 2/i);
    expect(client.criarEnvioAvancado).not.toHaveBeenCalled();
  });

  it("aplica os tratamentos da variável na mensagem enviada", async () => {
    await campanhaService.criar(ctx(), {
      ...DADOS,
      linhas: [{ Nome: "ANA MARIA DA SILVA", numero: "5511999999999" }],
      mapeamentoVariaveis: {
        nome: { coluna: "Nome", tratamentos: ["primeiro_nome", "titulo"] },
      },
    });

    const envio = client.criarEnvioAvancado.mock.calls[0][1];
    expect(envio.messages[0].text).toBe("Olá Ana, tudo bem?");
  });

  it("usa o valor padrão da variável quando a célula está vazia", async () => {
    await campanhaService.criar(ctx(), {
      ...DADOS,
      linhas: [{ Nome: "", numero: "5511999999999" }],
      mapeamentoVariaveis: { nome: { coluna: "Nome", tratamentos: [], padrao: "tudo bem" } },
    });

    const envio = client.criarEnvioAvancado.mock.calls[0][1];
    expect(envio.messages[0].text).toBe("Olá tudo bem, tudo bem?");
  });

  // O item é o snapshot do envio: guardar a célula crua faria o detalhe da campanha
  // mostrar um valor diferente do que apareceu na mensagem.
  it("guarda no item o valor já tratado, não a célula crua", async () => {
    await campanhaService.criar(ctx(), {
      ...DADOS,
      linhas: [{ Nome: "ANA MARIA DA SILVA", numero: "5511999999999" }],
      mapeamentoVariaveis: {
        nome: { coluna: "Nome", tratamentos: ["primeiro_nome", "titulo"] },
      },
    });

    expect(itensRepo.createMany).toHaveBeenCalledWith(
      [expect.objectContaining({ variaveis: { nome: "Ana" } })],
      expect.anything()
    );
  });

  it("grava o mapeamento com os tratamentos escolhidos", async () => {
    const mapeamentoVariaveis = {
      nome: { coluna: "Nome", tratamentos: ["primeiro_nome"] as const, padrao: "cliente" },
    };

    await campanhaService.criar(ctx(), { ...DADOS, mapeamentoVariaveis: mapeamentoVariaveis as never });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ mapeamentoVariaveis }),
      expect.anything()
    );
  });

  it("grava o nome do arquivo CSV quando informado", async () => {
    await campanhaService.criar(ctx(), { ...DADOS, arquivoCsvNome: "lista.csv" });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ arquivoCsvNome: "lista.csv" }),
      expect.anything()
    );
  });

  it("omite arquivoCsvNome quando não informado", async () => {
    await campanhaService.criar(ctx(), DADOS);

    expect(repo.create.mock.calls[0][0]).not.toHaveProperty("arquivoCsvNome");
  });

  it("pluraliza a mensagem quando mais de uma variável ficou sem coluna", async () => {
    await expect(
      campanhaService.criar(ctx(), {
        ...DADOS,
        mensagemTemplate: "Olá {{nome}} do {{bairro}}",
        mapeamentoVariaveis: {},
      })
    ).rejects.toThrow(/as variáveis \{\{nome\}\}, \{\{bairro\}\}/);
  });

  it("trata célula vazia da variável como string vazia na mensagem", async () => {
    await campanhaService.criar(ctx(), {
      ...DADOS,
      linhas: [{ Nome: "", numero: "5511999999999" }],
    });

    const envio = client.criarEnvioAvancado.mock.calls[0][1];
    expect(envio.messages[0].text).toBe("Olá , tudo bem?");
  });

  // Planilha sem nenhuma linha não tem cabeçalho para validar contra: recusa pela coluna
  // de número, antes de qualquer efeito.
  it("recusa planilha sem nenhuma linha", async () => {
    await expect(campanhaService.criar(ctx(), { ...DADOS, linhas: [] })).rejects.toThrow(
      DestinatariosInvalidosError
    );
  });

  // Citar 200 linhas numa toast não ajuda ninguém: a mensagem lista as 5 primeiras e
  // resume o resto.
  it("resume as linhas excedentes quando há muitos números inválidos", async () => {
    const linhas = Array.from({ length: 7 }, () => ({ Nome: "X", numero: "1234" }));

    await expect(campanhaService.criar(ctx(), { ...DADOS, linhas })).rejects.toThrow(
      /linha 1, 2, 3, 4, 5 e mais 2/
    );
  });

  // A UAZAPI é chamada antes da transação: se a chamada falha, nada é gravado.
  it("não grava nada quando a UAZAPI falha", async () => {
    client.criarEnvioAvancado.mockRejectedValue(new Error("indisponível"));

    await expect(campanhaService.criar(ctx(), DADOS)).rejects.toThrow();
    expect(repo.create).not.toHaveBeenCalled();
    expect(logs.registrar).not.toHaveBeenCalled();
  });
});

describe("campanhaService.listar", () => {
  it("lista as campanhas do escritório da sessão", async () => {
    repo.listar.mockResolvedValue([campanhaFake()]);

    const resultado = await campanhaService.listar(ctx("padrao"));

    expect(repo.listar).toHaveBeenCalledWith("esc-1");
    expect(resultado).toHaveLength(1);
  });
});

describe("campanhaService.obter", () => {
  it("devolve a campanha do próprio escritório", async () => {
    repo.findById.mockResolvedValue(campanhaFake());

    await expect(campanhaService.obter(ctx(), "campanha-1")).resolves.toMatchObject({
      id: "campanha-1",
    });
  });

  it("trata campanha de outro escritório como inexistente (RN19)", async () => {
    repo.findById.mockResolvedValue(campanhaFake({ escritorioId: "esc-2" }));

    await expect(campanhaService.obter(ctx(), "campanha-1")).rejects.toThrow(
      CampanhaNaoEncontradaError
    );
  });

  it("lança CampanhaNaoEncontradaError quando não existe", async () => {
    repo.findById.mockResolvedValue(null);

    await expect(campanhaService.obter(ctx(), "campanha-1")).rejects.toThrow(
      CampanhaNaoEncontradaError
    );
  });
});

describe("campanhaService.listarItens", () => {
  it("pagina os itens da campanha", async () => {
    repo.findById.mockResolvedValue(campanhaFake());
    itensRepo.listarPorCampanha.mockResolvedValue([]);
    itensRepo.contarPorCampanha.mockResolvedValue(120);

    const resultado = await campanhaService.listarItens(ctx(), "campanha-1", { pagina: 3 });

    expect(itensRepo.listarPorCampanha).toHaveBeenCalledWith("campanha-1", {
      pular: 100,
      limite: 50,
    });
    expect(resultado.total).toBe(120);
  });
});

describe("campanhaService.listarMensagens", () => {
  function paginaFake(mensagens: unknown[], total: number) {
    return { mensagens, total } as Awaited<
      ReturnType<typeof uazapiClient.listarMensagensCampanha>
    >;
  }

  function mensagemFake(over: Record<string, unknown> = {}) {
    return {
      id: "msg-1",
      chatid: "5511999998888@s.whatsapp.net",
      status: "Sent",
      erro: undefined,
      messageTimestamp: 1_777_000_000,
      ...over,
    };
  }

  it("consulta a UAZAPI com o folder da campanha e normaliza cada mensagem", async () => {
    repo.findById.mockResolvedValue(campanhaFake());
    instancias.obterComToken.mockResolvedValue(instanciaFake());
    client.listarMensagensCampanha.mockResolvedValue(
      paginaFake([mensagemFake(), mensagemFake({ status: "Failed", erro: "bloqueado" })], 2)
    );

    const resposta = await campanhaService.listarMensagens(ctx(), "campanha-1");

    expect(client.listarMensagensCampanha).toHaveBeenCalledWith("token-secreto", "folder-1");
    expect(resposta).toEqual({
      total: 2,
      mensagens: [
        {
          numero: "5511999998888",
          status: "enviada",
          erro: null,
          enviadaEm: new Date(1_777_000_000_000),
        },
        {
          numero: "5511999998888",
          status: "falha",
          erro: "bloqueado",
          enviadaEm: new Date(1_777_000_000_000),
        },
      ],
    });
  });

  // Papel padrão só lê — e consultar status é leitura.
  it("é liberada para o papel padrao", async () => {
    repo.findById.mockResolvedValue(campanhaFake());
    instancias.obterComToken.mockResolvedValue(instanciaFake());
    client.listarMensagensCampanha.mockResolvedValue(paginaFake([], 0));

    await expect(campanhaService.listarMensagens(ctx("padrao"), "campanha-1")).resolves.toEqual({
      mensagens: [],
      total: 0,
    });
  });

  // Consultar o histórico não é disparar: o token da instância continua valendo.
  it("não exige instância conectada", async () => {
    repo.findById.mockResolvedValue(campanhaFake());
    instancias.obterComToken.mockResolvedValue(instanciaFake({ status: "disconnected" }));
    client.listarMensagensCampanha.mockResolvedValue(paginaFake([mensagemFake()], 1));

    await expect(
      campanhaService.listarMensagens(ctx(), "campanha-1")
    ).resolves.toHaveProperty("total", 1);
  });

  it("recusa campanha de outro escritório", async () => {
    repo.findById.mockResolvedValue(campanhaFake({ escritorioId: "esc-2" }));

    await expect(
      campanhaService.listarMensagens(ctx(), "campanha-1")
    ).rejects.toBeInstanceOf(CampanhaNaoEncontradaError);
    expect(client.listarMensagensCampanha).not.toHaveBeenCalled();
  });

  it("recusa campanha cuja instância foi removida", async () => {
    repo.findById.mockResolvedValue(campanhaFake({ instanciaWhatsappId: null }));

    await expect(
      campanhaService.listarMensagens(ctx(), "campanha-1")
    ).rejects.toBeInstanceOf(CampanhaSemInstanciaError);
  });

  // Uma chamada só: a campanha inteira vem numa resposta.
  it("não pagina", async () => {
    repo.findById.mockResolvedValue(campanhaFake());
    instancias.obterComToken.mockResolvedValue(instanciaFake());
    const lote = Array.from({ length: 700 }, () => mensagemFake());
    client.listarMensagensCampanha.mockResolvedValue(paginaFake(lote, 700));

    const resposta = await campanhaService.listarMensagens(ctx(), "campanha-1");

    expect(resposta.mensagens).toHaveLength(700);
    expect(client.listarMensagensCampanha).toHaveBeenCalledTimes(1);
  });
});

describe("campanhaService.sincronizar", () => {
  beforeEach(() => {
    repo.findById.mockResolvedValue(campanhaFake());
    repo.update.mockImplementation(async (id, data) => ({ id, ...data }) as never);
  });

  it("atualiza contadores e status a partir do /sender/listfolders", async () => {
    client.listarCampanhas.mockResolvedValue([
      {
        id: "folder-1",
        status: "sending",
        logTotal: 10,
        logSucesso: 7,
        logFalha: 1,
        logEntregue: 6,
        logLido: 4,
        logReproduzido: 2,
      },
    ]);

    await campanhaService.sincronizar(ctx(), "campanha-1");

    expect(repo.update).toHaveBeenCalledWith(
      "campanha-1",
      expect.objectContaining({ status: "enviando", logTotal: 10, logSucesso: 7, logFalha: 1 }),
      expect.anything()
    );
  });

  // Mesmo critério do verificarStatus de instâncias: sincronização que não muda nada não
  // pode poluir a auditoria com um log por clique.
  it("não escreve nem loga quando nada mudou", async () => {
    client.listarCampanhas.mockResolvedValue([
      {
        id: "folder-1",
        status: "scheduled",
        logTotal: 0,
        logSucesso: 0,
        logFalha: 0,
        logEntregue: 0,
        logLido: 0,
        logReproduzido: 0,
      },
    ]);

    await campanhaService.sincronizar(ctx(), "campanha-1");

    expect(repo.update).not.toHaveBeenCalled();
    expect(logs.registrar).not.toHaveBeenCalled();
  });

  // Mesma defesa de paraStatusInstancia: status fora do contrato vira erro de domínio
  // antes de chegar no Prisma, cuja mensagem de validação ecoaria o data inteiro.
  it("recusa status de campanha desconhecido vindo da UAZAPI", async () => {
    client.listarCampanhas.mockResolvedValue([
      {
        id: "folder-1",
        status: "status-que-nao-existe",
        logTotal: 0,
        logSucesso: 0,
        logFalha: 0,
        logEntregue: 0,
        logLido: 0,
        logReproduzido: 0,
      },
    ]);

    await expect(campanhaService.sincronizar(ctx(), "campanha-1")).rejects.toBeInstanceOf(
      UazapiIndisponivelError
    );
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("permite role padrao sincronizar (é leitura de estado)", async () => {
    client.listarCampanhas.mockResolvedValue([]);

    await expect(campanhaService.sincronizar(ctx("padrao"), "campanha-1")).resolves.toBeDefined();
  });

  it("mantém o estado local quando o folder sumiu da UAZAPI", async () => {
    client.listarCampanhas.mockResolvedValue([]);

    await campanhaService.sincronizar(ctx(), "campanha-1");

    expect(repo.update).not.toHaveBeenCalled();
  });

  it("falha quando a instância que disparou não existe mais", async () => {
    repo.findById.mockResolvedValue(campanhaFake({ instanciaWhatsappId: null, instancia: null }));

    await expect(campanhaService.sincronizar(ctx(), "campanha-1")).rejects.toThrow(
      CampanhaSemInstanciaError
    );
  });
});

describe("campanhaService.controlar", () => {
  beforeEach(() => {
    repo.findById.mockResolvedValue(campanhaFake({ status: "enviando" }));
    repo.update.mockImplementation(async (id, data) => ({ id, ...data }) as never);
    repo.delete.mockResolvedValue(campanhaFake() as never);
    client.controlarCampanha.mockResolvedValue(undefined);
  });

  it("rejeita role padrao", async () => {
    await expect(campanhaService.controlar(ctx("padrao"), "campanha-1", "stop")).rejects.toThrow(
      PermissaoNegadaError
    );
    expect(client.controlarCampanha).not.toHaveBeenCalled();
  });

  it("pausa a campanha na UAZAPI e reflete o status local", async () => {
    await campanhaService.controlar(ctx(), "campanha-1", "stop");

    expect(client.controlarCampanha).toHaveBeenCalledWith("token-secreto", "folder-1", "stop");
    expect(repo.update).toHaveBeenCalledWith(
      "campanha-1",
      expect.objectContaining({ status: "pausada" }),
      expect.anything()
    );
  });

  it("retoma a campanha pausada", async () => {
    repo.findById.mockResolvedValue(campanhaFake({ status: "pausada" }));

    await campanhaService.controlar(ctx(), "campanha-1", "continue");

    expect(client.controlarCampanha).toHaveBeenCalledWith("token-secreto", "folder-1", "continue");
    expect(repo.update).toHaveBeenCalledWith(
      "campanha-1",
      expect.objectContaining({ status: "agendada" }),
      expect.anything()
    );
  });

  // O listfolders nunca mais devolveria essa campanha, então manter a linha local seria
  // um registro que não dá mais para sincronizar. O log (append-only) preserva o rastro.
  it("exclui a campanha localmente depois de excluir na UAZAPI", async () => {
    await campanhaService.controlar(ctx(), "campanha-1", "delete");

    expect(client.controlarCampanha).toHaveBeenCalledWith("token-secreto", "folder-1", "delete");
    expect(repo.delete).toHaveBeenCalledWith("campanha-1", expect.anything());
    expect(logs.registrar).toHaveBeenCalledWith(
      ctx(),
      expect.objectContaining({ acao: "excluir", entidade: "campanha" }),
      expect.anything()
    );
  });

  it("não altera o banco se a UAZAPI recusar a ação", async () => {
    client.controlarCampanha.mockRejectedValue(new Error("indisponível"));

    await expect(campanhaService.controlar(ctx(), "campanha-1", "stop")).rejects.toThrow();
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it("falha quando a instância que disparou não existe mais", async () => {
    repo.findById.mockResolvedValue(campanhaFake({ instanciaWhatsappId: null, instancia: null }));

    await expect(campanhaService.controlar(ctx(), "campanha-1", "stop")).rejects.toThrow(
      CampanhaSemInstanciaError
    );
  });
});
