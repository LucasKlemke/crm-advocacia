import {
  casoService,
  CasoNaoEncontradoError,
  ClienteInativoError,
  ResponsavelInvalidoError,
} from "./caso.service";
import { casoRepository, type CasoComRelacoes } from "@/repositories/caso.repository";
import { statusRepository } from "@/repositories/status.repository";
import { membroRepository } from "@/repositories/membro.repository";
import { clienteService, ClienteNaoEncontradoError } from "@/services/cliente.service";
import { statusService, StatusNaoEncontradoError } from "@/services/status.service";
import { logService } from "@/services/log.service";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { Cliente, Membro, Status } from "@prisma/client";

jest.mock("@/repositories/caso.repository");
jest.mock("@/repositories/status.repository");
jest.mock("@/repositories/membro.repository");
jest.mock("@/services/cliente.service", () => {
  class ClienteNaoEncontradoError extends Error {}
  return {
    clienteService: { obter: jest.fn() },
    ClienteNaoEncontradoError,
  };
});
jest.mock("@/services/status.service", () => {
  class StatusNaoEncontradoError extends Error {}
  return {
    statusService: { obter: jest.fn() },
    StatusNaoEncontradoError,
  };
});
jest.mock("@/services/log.service");
jest.mock("@/lib/prisma", () => ({
  // A transação roda o callback direto: os repositórios já estão mockados.
  prisma: { $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({})) },
}));

const repo = casoRepository as jest.Mocked<typeof casoRepository>;
const statusRepo = statusRepository as jest.Mocked<typeof statusRepository>;
const membroRepo = membroRepository as jest.Mocked<typeof membroRepository>;
const clientes = clienteService as jest.Mocked<typeof clienteService>;
const status = statusService as jest.Mocked<typeof statusService>;
const logs = logService as jest.Mocked<typeof logService>;

function ctx(role: TenantContext["role"] = "padrao"): TenantContext {
  return { usuarioId: "user-1", escritorioId: "esc-1", role };
}

// Data fixa: gerar `new Date()` de novo em cada fake produziria timestamps diferentes
// por poucos milissegundos e quebraria os toEqual entre chamadas equivalentes.
const AGORA = new Date("2026-08-01T12:00:00.000Z");

function clienteFake(over: Partial<Cliente> = {}): Cliente {
  return {
    id: "cliente-1",
    escritorioId: "esc-1",
    nome: "Cliente Teste",
    cpf: "52998224725",
    email: null,
    telefone: null,
    endereco: null,
    softDeletedAt: null,
    createdAt: AGORA,
    updatedAt: AGORA,
    ...over,
  };
}

function statusFake(over: Partial<Status> = {}): Status {
  return {
    id: "status-1",
    escritorioId: "esc-1",
    tipoStatusId: "tipo-1",
    nome: "Nova conversa",
    icone: "MessageCircle",
    cor: "#64748b",
    descricao: null,
    ordem: 1,
    createdAt: AGORA,
    updatedAt: AGORA,
    ...over,
  };
}

function membroFake(over: Partial<Membro> = {}): Membro {
  return {
    id: "membro-1",
    usuarioId: "usuario-1",
    escritorioId: "esc-1",
    role: "padrao",
    createdAt: AGORA,
    updatedAt: AGORA,
    ...over,
  };
}

function casoFake(over: Partial<CasoComRelacoes> = {}): CasoComRelacoes {
  return {
    id: "caso-1",
    escritorioId: "esc-1",
    clienteId: "cliente-1",
    statusId: "status-1",
    responsavelMembroId: null,
    titulo: "Ação de Cobrança",
    descricao: null,
    valor: null,
    arquivado: false,
    createdAt: AGORA,
    updatedAt: AGORA,
    cliente: clienteFake(),
    status: statusFake(),
    responsavel: null,
    ...over,
  } as unknown as CasoComRelacoes;
}

beforeEach(() => {
  jest.clearAllMocks();
  logs.registrar.mockResolvedValue({} as never);
  clientes.obter.mockResolvedValue(clienteFake());
  status.obter.mockResolvedValue(statusFake());
});

describe("casoService.obter", () => {
  it("devolve o caso do próprio escritório", async () => {
    repo.findById.mockResolvedValue(casoFake());
    await expect(casoService.obter(ctx(), "caso-1")).resolves.toMatchObject({ id: "caso-1" });
  });

  it("trata caso inexistente como não encontrado", async () => {
    repo.findById.mockResolvedValue(null);
    await expect(casoService.obter(ctx(), "caso-1")).rejects.toThrow(CasoNaoEncontradoError);
  });

  // RN19: caso de outro tenant não pode nem ter sua existência confirmada.
  it("trata caso de outro escritório como não encontrado", async () => {
    repo.findById.mockResolvedValue(casoFake({ escritorioId: "esc-2" }));
    await expect(casoService.obter(ctx(), "caso-1")).rejects.toThrow(CasoNaoEncontradoError);
  });
});

describe("casoService.listar", () => {
  it("delega ao repositório escopado ao escritório", async () => {
    repo.listar.mockResolvedValue([casoFake()]);
    repo.contar.mockResolvedValue(1);

    const resultado = await casoService.listar(ctx(), { busca: "cobrança" });

    expect(repo.listar).toHaveBeenCalledWith("esc-1", { busca: "cobrança" });
    expect(repo.contar).toHaveBeenCalledWith("esc-1", { busca: "cobrança" });
    expect(resultado).toEqual({ casos: [casoFake()], total: 1 });
  });
});

describe("casoService.listarKanban", () => {
  it("monta uma coluna por status, com total e primeira página de casos", async () => {
    const colunaUm = statusFake({ id: "status-1", ordem: 1 });
    const colunaDois = statusFake({ id: "status-2", ordem: 2, nome: "Em análise" });
    statusRepo.listar.mockResolvedValue([colunaUm, colunaDois]);
    repo.listar.mockResolvedValueOnce([casoFake()]).mockResolvedValueOnce([]);
    repo.contar.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    const colunas = await casoService.listarKanban(ctx());

    expect(colunas).toEqual([
      { status: colunaUm, total: 1, casos: [casoFake()] },
      { status: colunaDois, total: 0, casos: [] },
    ]);
    expect(repo.listar).toHaveBeenNthCalledWith(
      1,
      "esc-1",
      expect.objectContaining({ statusIds: ["status-1"] })
    );
  });
});

describe("casoService.criar", () => {
  const dados = { titulo: "Novo Caso", clienteId: "cliente-1", statusId: "status-1" };

  it("valida o cliente, o status e cria o caso", async () => {
    repo.create.mockResolvedValue(casoFake());

    await casoService.criar(ctx(), dados);

    expect(clientes.obter).toHaveBeenCalledWith(ctx(), "cliente-1");
    expect(status.obter).toHaveBeenCalledWith(ctx(), "status-1");
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        titulo: "Novo Caso",
        escritorio: { connect: { id: "esc-1" } },
        cliente: { connect: { id: "cliente-1" } },
        status: { connect: { id: "status-1" } },
      }),
      expect.anything()
    );
    expect(logs.registrar).toHaveBeenCalledWith(
      ctx(),
      expect.objectContaining({ acao: "criar", entidade: "caso", entidadeId: "caso-1" }),
      expect.anything()
    );
  });

  it("propaga erro quando o cliente não é do tenant", async () => {
    clientes.obter.mockRejectedValue(new ClienteNaoEncontradoError());
    await expect(casoService.criar(ctx(), dados)).rejects.toThrow(ClienteNaoEncontradoError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("rejeita cliente inativo (RN06)", async () => {
    clientes.obter.mockResolvedValue(clienteFake({ softDeletedAt: new Date() }));
    await expect(casoService.criar(ctx(), dados)).rejects.toThrow(ClienteInativoError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("propaga erro quando o status não é do tenant", async () => {
    status.obter.mockRejectedValue(new StatusNaoEncontradoError());
    await expect(casoService.criar(ctx(), dados)).rejects.toThrow(StatusNaoEncontradoError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("valida o responsável quando informado", async () => {
    membroRepo.findById.mockResolvedValue(membroFake());
    repo.create.mockResolvedValue(casoFake({ responsavelMembroId: "membro-1" }));

    await casoService.criar(ctx(), { ...dados, responsavelMembroId: "membro-1" });

    expect(membroRepo.findById).toHaveBeenCalledWith("membro-1");
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ responsavel: { connect: { id: "membro-1" } } }),
      expect.anything()
    );
  });

  it("rejeita responsável de outro escritório", async () => {
    membroRepo.findById.mockResolvedValue(membroFake({ escritorioId: "esc-2" }));
    await expect(
      casoService.criar(ctx(), { ...dados, responsavelMembroId: "membro-1" })
    ).rejects.toThrow(ResponsavelInvalidoError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("rejeita responsável inexistente", async () => {
    membroRepo.findById.mockResolvedValue(null);
    await expect(
      casoService.criar(ctx(), { ...dados, responsavelMembroId: "membro-1" })
    ).rejects.toThrow(ResponsavelInvalidoError);
  });

  it("qualquer papel (inclusive padrao) pode criar caso", async () => {
    repo.create.mockResolvedValue(casoFake());
    await expect(casoService.criar(ctx("padrao"), dados)).resolves.toBeDefined();
  });
});

describe("casoService.atualizar", () => {
  it("não grava nem loga quando nada muda", async () => {
    repo.findById.mockResolvedValue(casoFake());

    const resultado = await casoService.atualizar(ctx(), "caso-1", { titulo: "Ação de Cobrança" });

    expect(resultado).toEqual(casoFake());
    expect(repo.update).not.toHaveBeenCalled();
    expect(logs.registrar).not.toHaveBeenCalled();
  });

  it("atualiza e registra o diff no log", async () => {
    repo.findById.mockResolvedValue(casoFake());
    repo.update.mockResolvedValue(casoFake({ titulo: "Renomeado" }));

    await casoService.atualizar(ctx(), "caso-1", { titulo: "Renomeado" });

    expect(repo.update).toHaveBeenCalledWith(
      "caso-1",
      expect.objectContaining({ titulo: "Renomeado" }),
      expect.anything()
    );
    expect(logs.registrar).toHaveBeenCalledWith(
      ctx(),
      expect.objectContaining({
        acao: "atualizar",
        entidade: "caso",
        dados: expect.objectContaining({
          titulo: { antes: "Ação de Cobrança", depois: "Renomeado" },
        }),
      }),
      expect.anything()
    );
  });

  it("permite trocar de status (mudança de coluna do kanban)", async () => {
    repo.findById.mockResolvedValue(casoFake());
    status.obter.mockResolvedValue(statusFake({ id: "status-2" }));
    repo.update.mockResolvedValue(casoFake({ statusId: "status-2" }));

    await casoService.atualizar(ctx(), "caso-1", { statusId: "status-2" });

    expect(status.obter).toHaveBeenCalledWith(ctx(), "status-2");
    expect(repo.update).toHaveBeenCalledWith(
      "caso-1",
      expect.objectContaining({ status: { connect: { id: "status-2" } } }),
      expect.anything()
    );
  });

  it("troca de cliente ativo com sucesso", async () => {
    repo.findById.mockResolvedValue(casoFake());
    clientes.obter.mockResolvedValue(clienteFake({ id: "cliente-2" }));
    repo.update.mockResolvedValue(casoFake({ clienteId: "cliente-2" }));

    await casoService.atualizar(ctx(), "caso-1", { clienteId: "cliente-2" });

    expect(repo.update).toHaveBeenCalledWith(
      "caso-1",
      expect.objectContaining({ cliente: { connect: { id: "cliente-2" } } }),
      expect.anything()
    );
  });

  it("atribui um responsável a um caso que não tinha", async () => {
    repo.findById.mockResolvedValue(casoFake());
    membroRepo.findById.mockResolvedValue(membroFake());
    repo.update.mockResolvedValue(casoFake({ responsavelMembroId: "membro-1" }));

    await casoService.atualizar(ctx(), "caso-1", { responsavelMembroId: "membro-1" });

    expect(membroRepo.findById).toHaveBeenCalledWith("membro-1");
    expect(repo.update).toHaveBeenCalledWith(
      "caso-1",
      expect.objectContaining({ responsavel: { connect: { id: "membro-1" } } }),
      expect.anything()
    );
  });

  it("remove o responsável quando responsavelMembroId vira null", async () => {
    repo.findById.mockResolvedValue(
      casoFake({ responsavelMembroId: "membro-1", responsavel: membroFake() as never })
    );
    repo.update.mockResolvedValue(casoFake({ responsavelMembroId: null }));

    await casoService.atualizar(ctx(), "caso-1", { responsavelMembroId: null });

    expect(membroRepo.findById).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith(
      "caso-1",
      expect.objectContaining({ responsavel: { disconnect: true } }),
      expect.anything()
    );
  });

  it("atualiza descrição e valor", async () => {
    repo.findById.mockResolvedValue(casoFake());
    repo.update.mockResolvedValue(casoFake({ descricao: "Detalhes novos", valor: 500 as never }));

    await casoService.atualizar(ctx(), "caso-1", { descricao: "Detalhes novos", valor: 500 });

    expect(repo.update).toHaveBeenCalledWith(
      "caso-1",
      expect.objectContaining({ descricao: "Detalhes novos", valor: 500 }),
      expect.anything()
    );
  });

  it("valida cliente inativo ao trocar de cliente", async () => {
    repo.findById.mockResolvedValue(casoFake());
    clientes.obter.mockResolvedValue(clienteFake({ id: "cliente-2", softDeletedAt: new Date() }));

    await expect(
      casoService.atualizar(ctx(), "caso-1", { clienteId: "cliente-2" })
    ).rejects.toThrow(ClienteInativoError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("trata caso de outro escritório como não encontrado", async () => {
    repo.findById.mockResolvedValue(casoFake({ escritorioId: "esc-2" }));
    await expect(
      casoService.atualizar(ctx(), "caso-1", { titulo: "X" })
    ).rejects.toThrow(CasoNaoEncontradoError);
  });
});

describe("casoService.arquivar / desarquivar", () => {
  it("arquiva e registra log", async () => {
    repo.findById.mockResolvedValue(casoFake());
    repo.update.mockResolvedValue(casoFake({ arquivado: true }));

    await casoService.arquivar(ctx(), "caso-1");

    expect(repo.update).toHaveBeenCalledWith("caso-1", { arquivado: true }, expect.anything());
    expect(logs.registrar).toHaveBeenCalledWith(
      ctx(),
      expect.objectContaining({ acao: "atualizar", entidade: "caso" }),
      expect.anything()
    );
  });

  it("é idempotente ao arquivar um caso já arquivado", async () => {
    repo.findById.mockResolvedValue(casoFake({ arquivado: true }));

    await casoService.arquivar(ctx(), "caso-1");

    expect(repo.update).not.toHaveBeenCalled();
    expect(logs.registrar).not.toHaveBeenCalled();
  });

  it("desarquiva e registra log", async () => {
    repo.findById.mockResolvedValue(casoFake({ arquivado: true }));
    repo.update.mockResolvedValue(casoFake({ arquivado: false }));

    await casoService.desarquivar(ctx(), "caso-1");

    expect(repo.update).toHaveBeenCalledWith("caso-1", { arquivado: false }, expect.anything());
  });

  it("é idempotente ao desarquivar um caso já ativo", async () => {
    repo.findById.mockResolvedValue(casoFake({ arquivado: false }));

    await casoService.desarquivar(ctx(), "caso-1");

    expect(repo.update).not.toHaveBeenCalled();
    expect(logs.registrar).not.toHaveBeenCalled();
  });
});
