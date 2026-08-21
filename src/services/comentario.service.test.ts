import {
  comentarioService,
  ComentarioNaoEncontradoError,
  ConteudoVazioError,
  PermissaoComentarioError,
} from "./comentario.service";
import { comentarioRepository } from "@/repositories/comentario.repository";
import { clienteService, ClienteNaoEncontradoError } from "@/services/cliente.service";
import { casoService, CasoNaoEncontradoError } from "@/services/caso.service";
import { logService } from "@/services/log.service";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { Comentario } from "@prisma/client";

jest.mock("@/repositories/comentario.repository");
jest.mock("@/services/log.service");
jest.mock("@/services/cliente.service", () => ({
  clienteService: { obter: jest.fn() },
  ClienteNaoEncontradoError: class ClienteNaoEncontradoError extends Error {},
}));
jest.mock("@/services/caso.service", () => ({
  casoService: { obter: jest.fn() },
  CasoNaoEncontradoError: class CasoNaoEncontradoError extends Error {},
}));
jest.mock("@/lib/prisma", () => ({
  prisma: { $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({})) },
}));

const repo = comentarioRepository as jest.Mocked<typeof comentarioRepository>;
const logs = logService as jest.Mocked<typeof logService>;
const clientes = clienteService as jest.Mocked<typeof clienteService>;
const casos = casoService as jest.Mocked<typeof casoService>;

const autor: TenantContext = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" };
const outroPadrao: TenantContext = { usuarioId: "user-2", escritorioId: "esc-1", role: "padrao" };
const admin: TenantContext = { usuarioId: "user-3", escritorioId: "esc-1", role: "admin" };

function comentarioFake(over: Partial<Comentario> = {}): Comentario {
  return {
    id: "com-1",
    escritorioId: "esc-1",
    escopo: "cliente",
    escopoId: "cli-1",
    autorUsuarioId: "user-1",
    conteudo: "Primeiro contato feito.",
    editadoEm: null,
    softDeletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  logs.registrar.mockResolvedValue({} as never);
  clientes.obter.mockResolvedValue({ id: "cli-1", nome: "Maria Silva" } as never);
  casos.obter.mockResolvedValue({ id: "caso-1", titulo: "Ação de Cobrança" } as never);
});

describe("comentarioService.criar", () => {
  it("ancora o comentário no autor e no escritório da sessão e registra log", async () => {
    repo.create.mockResolvedValue(comentarioFake());

    await comentarioService.criar(autor, "cliente", "cli-1", "  Primeiro contato feito.  ");

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        escopo: "cliente",
        escopoId: "cli-1",
        conteudo: "Primeiro contato feito.",
        autor: { connect: { id: "user-1" } },
        escritorio: { connect: { id: "esc-1" } },
      }),
      expect.anything()
    );
    expect(logs.registrar).toHaveBeenCalledWith(
      autor,
      expect.objectContaining({ acao: "criar", entidade: "comentario", entidadeId: "com-1" }),
      expect.anything()
    );
  });

  it("recusa conteúdo em branco", async () => {
    await expect(comentarioService.criar(autor, "cliente", "cli-1", "   ")).rejects.toThrow(
      ConteudoVazioError
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  // (escopo, escopo_id) não tem FK: se o alvo não é do tenant, nada pode ser ancorado nele.
  it("recusa comentar em cliente de outro escritório", async () => {
    clientes.obter.mockRejectedValue(new ClienteNaoEncontradoError());
    await expect(comentarioService.criar(autor, "cliente", "cli-alheio", "oi")).rejects.toThrow(
      ClienteNaoEncontradoError
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  // RN21: comentário também ancora em caso, não só em cliente.
  it("ancora o comentário num caso e registra o título dele no log", async () => {
    repo.create.mockResolvedValue(comentarioFake({ escopo: "caso", escopoId: "caso-1" }));

    await comentarioService.criar(autor, "caso", "caso-1", "Audiência marcada.");

    expect(casos.obter).toHaveBeenCalledWith(autor, "caso-1");
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ escopo: "caso", escopoId: "caso-1" }),
      expect.anything()
    );
    expect(logs.registrar).toHaveBeenCalledWith(
      autor,
      expect.objectContaining({
        acao: "criar",
        entidade: "comentario",
        resumo: "Comentário adicionado ao caso Ação de Cobrança",
      }),
      expect.anything()
    );
  });

  // (escopo, escopo_id) não tem FK: se o alvo não é do tenant, nada pode ser ancorado nele.
  it("recusa comentar em caso de outro escritório", async () => {
    casos.obter.mockRejectedValue(new CasoNaoEncontradoError());
    await expect(comentarioService.criar(autor, "caso", "caso-alheio", "oi")).rejects.toThrow(
      CasoNaoEncontradoError
    );
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe("comentarioService.atualizar", () => {
  it("o autor edita o próprio comentário e o diff vai para o log", async () => {
    repo.findById.mockResolvedValue(comentarioFake());
    repo.update.mockResolvedValue(comentarioFake({ conteudo: "Texto novo" }));

    await comentarioService.atualizar(autor, "com-1", "Texto novo");

    expect(repo.update).toHaveBeenCalledWith(
      "com-1",
      expect.objectContaining({ conteudo: "Texto novo", editadoEm: expect.any(Date) }),
      expect.anything()
    );
    expect(logs.registrar).toHaveBeenCalledWith(
      autor,
      expect.objectContaining({
        acao: "atualizar",
        dados: { conteudo: { antes: "Primeiro contato feito.", depois: "Texto novo" } },
      }),
      expect.anything()
    );
  });

  it("nem admin pode editar comentário de outra pessoa", async () => {
    repo.findById.mockResolvedValue(comentarioFake());
    await expect(comentarioService.atualizar(admin, "com-1", "Texto novo")).rejects.toThrow(
      PermissaoComentarioError
    );
  });

  it("recusa esvaziar o comentário", async () => {
    await expect(comentarioService.atualizar(autor, "com-1", "  ")).rejects.toThrow(
      ConteudoVazioError
    );
  });

  it("não escreve nem loga quando o texto é idêntico", async () => {
    repo.findById.mockResolvedValue(comentarioFake());
    await comentarioService.atualizar(autor, "com-1", "Primeiro contato feito.");

    expect(repo.update).not.toHaveBeenCalled();
    expect(logs.registrar).not.toHaveBeenCalled();
  });

  it("trata comentário de outro escritório como não encontrado (RN19)", async () => {
    repo.findById.mockResolvedValue(comentarioFake({ escritorioId: "esc-2" }));
    await expect(comentarioService.atualizar(autor, "com-1", "x")).rejects.toThrow(
      ComentarioNaoEncontradoError
    );
  });

  it("trata comentário já excluído como não encontrado", async () => {
    repo.findById.mockResolvedValue(comentarioFake({ softDeletedAt: new Date() }));
    await expect(comentarioService.atualizar(autor, "com-1", "x")).rejects.toThrow(
      ComentarioNaoEncontradoError
    );
  });
});

describe("comentarioService.excluir", () => {
  it("o autor exclui o próprio comentário (soft delete + log)", async () => {
    repo.findById.mockResolvedValue(comentarioFake());
    repo.marcarExcluido.mockResolvedValue(comentarioFake());

    await comentarioService.excluir(autor, "com-1");

    expect(repo.marcarExcluido).toHaveBeenCalledWith("com-1", expect.any(Date), expect.anything());
    expect(logs.registrar).toHaveBeenCalledWith(
      autor,
      expect.objectContaining({ acao: "excluir", entidade: "comentario" }),
      expect.anything()
    );
  });

  it("admin modera comentário de terceiros", async () => {
    repo.findById.mockResolvedValue(comentarioFake());
    repo.marcarExcluido.mockResolvedValue(comentarioFake());

    await expect(comentarioService.excluir(admin, "com-1")).resolves.toBeUndefined();
  });

  it("membro padrão não exclui comentário alheio", async () => {
    repo.findById.mockResolvedValue(comentarioFake());
    await expect(comentarioService.excluir(outroPadrao, "com-1")).rejects.toThrow(
      PermissaoComentarioError
    );
    expect(repo.marcarExcluido).not.toHaveBeenCalled();
  });
});

describe("comentarioService.listar", () => {
  it("valida o alvo antes de listar e escopa ao escritório", async () => {
    repo.listarPorEscopo.mockResolvedValue([]);

    await comentarioService.listar(autor, "cliente", "cli-1");

    expect(clientes.obter).toHaveBeenCalledWith(autor, "cli-1");
    expect(repo.listarPorEscopo).toHaveBeenCalledWith("esc-1", "cliente", "cli-1");
  });

  it("valida o caso antes de listar quando o escopo é caso", async () => {
    repo.listarPorEscopo.mockResolvedValue([]);

    await comentarioService.listar(autor, "caso", "caso-1");

    expect(casos.obter).toHaveBeenCalledWith(autor, "caso-1");
    expect(repo.listarPorEscopo).toHaveBeenCalledWith("esc-1", "caso", "caso-1");
  });
});
