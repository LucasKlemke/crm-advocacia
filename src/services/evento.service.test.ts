import {
  eventoService,
  EventoNaoEncontradoError,
  VinculoEventoExclusivoError,
  ParticipanteInvalidoError,
  ModalidadeEventoInvalidaError,
  MembroDaSessaoInvalidoError,
  PermissaoNegadaError,
} from "@/services/evento.service";
import { PeriodoEventoInvalidoError } from "@/lib/utils/evento-periodo";
import { eventoRepository } from "@/repositories/evento.repository";
import { membroRepository } from "@/repositories/membro.repository";
import { casoService } from "@/services/caso.service";
import { clienteService } from "@/services/cliente.service";
import { logService } from "@/services/log.service";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { RoleMembro } from "@prisma/client";

jest.mock("@/repositories/evento.repository");
jest.mock("@/repositories/membro.repository");
jest.mock("@/services/caso.service");
jest.mock("@/services/cliente.service");
jest.mock("@/services/log.service");
jest.mock("@/lib/prisma", () => ({
  prisma: { $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({})) },
}));

const repo = eventoRepository as jest.Mocked<typeof eventoRepository>;
const membros = membroRepository as jest.Mocked<typeof membroRepository>;
const casos = casoService as jest.Mocked<typeof casoService>;
const clientes = clienteService as jest.Mocked<typeof clienteService>;
const logs = logService as jest.Mocked<typeof logService>;

const ESCRITORIO = "esc-1";
const MEMBRO_ATOR = "membro-ator";
const MEMBRO_OUTRO = "membro-outro";

function ctx(role: RoleMembro = "owner", usuarioId = "usuario-ator"): TenantContext {
  return { usuarioId, escritorioId: ESCRITORIO, role };
}

function membroFake(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    usuarioId: `usuario-${id}`,
    escritorioId: ESCRITORIO,
    role: "padrao" as RoleMembro,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

function eventoFake(over: Record<string, unknown> = {}) {
  return {
    id: "evento-1",
    escritorioId: ESCRITORIO,
    titulo: "Audiência",
    descricao: null,
    inicio: new Date("2026-09-10T13:00:00.000Z"),
    fim: new Date("2026-09-10T14:00:00.000Z"),
    diaInteiro: false,
    modalidade: "presencial" as const,
    local: "Fórum",
    linkReuniao: null,
    clienteId: null,
    casoId: null,
    criadoPorMembroId: MEMBRO_ATOR,
    softDeletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    cliente: null,
    caso: null,
    criadoPor: {
      id: MEMBRO_ATOR,
      usuario: {
        id: "usuario-ator",
        nome: "Ator",
        email: "ator@teste.com",
        telefone: null,
        avatarUrl: null,
      },
    },
    participantes: [],
    ...over,
  };
}

const DADOS_BASE = {
  titulo: "Audiência de instrução",
  inicio: "2026-09-10T13:00:00.000Z",
  fim: "2026-09-10T14:00:00.000Z",
  modalidade: "presencial" as const,
  local: "Fórum de Joinville",
};

beforeEach(() => {
  jest.clearAllMocks();
  logs.registrar.mockResolvedValue({} as never);
  // Por padrão o ator é membro do escritório e é o único membro conhecido.
  membros.findByUsuarioEEscritorio.mockResolvedValue(
    membroFake(MEMBRO_ATOR, { role: "owner" }) as never
  );
  membros.listarPorEscritorio.mockResolvedValue([
    membroFake(MEMBRO_ATOR),
    membroFake(MEMBRO_OUTRO),
  ] as never);
  repo.create.mockResolvedValue(eventoFake() as never);
  repo.findById.mockResolvedValue(eventoFake() as never);
  repo.update.mockResolvedValue(eventoFake() as never);
  repo.softDelete.mockResolvedValue(eventoFake() as never);
  repo.substituirParticipantes.mockResolvedValue(undefined as never);
});

describe("eventoService.listarNoPeriodo", () => {
  it("lista os eventos do escritório da sessão no período (RN31)", async () => {
    repo.listarNoPeriodo.mockResolvedValue([eventoFake()] as never);
    const periodo = {
      inicio: new Date("2026-09-01T00:00:00.000Z"),
      fim: new Date("2026-09-30T23:59:59.999Z"),
    };

    const eventos = await eventoService.listarNoPeriodo(ctx("padrao"), periodo);

    expect(eventos).toHaveLength(1);
    expect(repo.listarNoPeriodo).toHaveBeenCalledWith(ESCRITORIO, periodo);
  });

  it("membro padrão vê evento criado por outra pessoa — agenda é compartilhada (RN31)", async () => {
    repo.listarNoPeriodo.mockResolvedValue([
      eventoFake({ criadoPorMembroId: MEMBRO_OUTRO }),
    ] as never);

    const eventos = await eventoService.listarNoPeriodo(ctx("padrao"), {
      inicio: new Date("2026-09-01T00:00:00.000Z"),
      fim: new Date("2026-09-30T23:59:59.999Z"),
    });

    expect(eventos).toHaveLength(1);
  });
});

describe("eventoService.obter", () => {
  it("trata evento de outro escritório como inexistente (RN19)", async () => {
    repo.findById.mockResolvedValue(eventoFake({ escritorioId: "outro-esc" }) as never);
    await expect(eventoService.obter(ctx(), "evento-1")).rejects.toThrow(EventoNaoEncontradoError);
  });

  it("trata evento com soft delete como inexistente (RN34)", async () => {
    repo.findById.mockResolvedValue(eventoFake({ softDeletedAt: new Date() }) as never);
    await expect(eventoService.obter(ctx(), "evento-1")).rejects.toThrow(EventoNaoEncontradoError);
  });
});

describe("eventoService.criar", () => {
  it("cria o evento e grava o log na mesma transação (RN20)", async () => {
    await eventoService.criar(ctx(), DADOS_BASE);

    expect(repo.create).toHaveBeenCalled();
    expect(logs.registrar).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ acao: "criar", entidade: "evento" }),
      expect.anything()
    );
  });

  it("recusa vínculo com caso e cliente ao mesmo tempo (RN31)", async () => {
    await expect(
      eventoService.criar(ctx(), { ...DADOS_BASE, casoId: "caso-1", clienteId: "cliente-1" })
    ).rejects.toThrow(VinculoEventoExclusivoError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("valida o caso vinculado contra o tenant antes de escrever (RN31/RN19)", async () => {
    casos.obter.mockResolvedValue({ id: "caso-1" } as never);
    await eventoService.criar(ctx(), { ...DADOS_BASE, casoId: "caso-1" });
    expect(casos.obter).toHaveBeenCalledWith(expect.anything(), "caso-1");
  });

  it("valida o cliente vinculado contra o tenant antes de escrever (RN31/RN19)", async () => {
    clientes.obter.mockResolvedValue({ id: "cliente-1" } as never);
    await eventoService.criar(ctx(), { ...DADOS_BASE, clienteId: "cliente-1" });
    expect(clientes.obter).toHaveBeenCalledWith(expect.anything(), "cliente-1");
  });

  it("exige local no presencial e link no online, limpando o campo da outra modalidade (RN32)", async () => {
    await expect(
      eventoService.criar(ctx(), { ...DADOS_BASE, local: null })
    ).rejects.toThrow(ModalidadeEventoInvalidaError);

    await expect(
      eventoService.criar(ctx(), { ...DADOS_BASE, modalidade: "online", local: null })
    ).rejects.toThrow(ModalidadeEventoInvalidaError);

    await eventoService.criar(ctx(), {
      ...DADOS_BASE,
      modalidade: "online",
      linkReuniao: "https://meet.example.com/x",
    });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ modalidade: "online", local: null }),
      expect.anything()
    );
  });

  it("inclui o criador entre os participantes automaticamente (RN33)", async () => {
    await eventoService.criar(ctx(), { ...DADOS_BASE, participanteMembroIds: [MEMBRO_OUTRO] });

    expect(repo.substituirParticipantes).toHaveBeenCalledWith(
      "evento-1",
      expect.arrayContaining([MEMBRO_ATOR, MEMBRO_OUTRO]),
      expect.anything()
    );
  });

  it("recusa participante que não é membro do escritório (RN33/RN19)", async () => {
    await expect(
      eventoService.criar(ctx(), { ...DADOS_BASE, participanteMembroIds: ["membro-de-fora"] })
    ).rejects.toThrow(ParticipanteInvalidoError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("normaliza evento de dia inteiro para a faixa do dia (RN35)", async () => {
    await eventoService.criar(ctx(), { ...DADOS_BASE, diaInteiro: true });

    const dados = repo.create.mock.calls[0][0] as { inicio: Date; fim: Date };
    expect(dados.inicio.toISOString()).toBe("2026-09-10T00:00:00.000Z");
    expect(dados.fim.toISOString()).toBe("2026-09-10T23:59:59.999Z");
  });

  it("recusa fim anterior ao início (RN35)", async () => {
    await expect(
      eventoService.criar(ctx(), { ...DADOS_BASE, fim: "2026-09-10T12:00:00.000Z" })
    ).rejects.toThrow(PeriodoEventoInvalidoError);
  });

  it("recusa criar quando o usuário da sessão não é membro do escritório (RN19)", async () => {
    membros.findByUsuarioEEscritorio.mockResolvedValue(null as never);
    await expect(eventoService.criar(ctx(), DADOS_BASE)).rejects.toThrow(
      MembroDaSessaoInvalidoError
    );
  });
});

describe("eventoService.atualizar", () => {
  it("deixa o autor editar o próprio evento (RN34)", async () => {
    await eventoService.atualizar(ctx("padrao"), "evento-1", { titulo: "Novo título" });
    expect(repo.update).toHaveBeenCalled();
  });

  it("deixa owner/admin editar evento de outro membro (RN34)", async () => {
    repo.findById.mockResolvedValue(eventoFake({ criadoPorMembroId: MEMBRO_OUTRO }) as never);
    membros.findByUsuarioEEscritorio.mockResolvedValue(
      membroFake(MEMBRO_ATOR, { role: "admin" }) as never
    );

    await eventoService.atualizar(ctx("admin"), "evento-1", { titulo: "Remarcado" });
    expect(repo.update).toHaveBeenCalled();
  });

  it("bloqueia membro padrão em evento de outra pessoa (RN34)", async () => {
    repo.findById.mockResolvedValue(eventoFake({ criadoPorMembroId: MEMBRO_OUTRO }) as never);

    await expect(
      eventoService.atualizar(ctx("padrao"), "evento-1", { titulo: "Remarcado" })
    ).rejects.toThrow(PermissaoNegadaError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("não toca no banco nem grava log quando nada mudou (RN20)", async () => {
    await eventoService.atualizar(ctx(), "evento-1", { titulo: "Audiência" });
    expect(repo.update).not.toHaveBeenCalled();
    expect(logs.registrar).not.toHaveBeenCalled();
  });

  it("grava o diff do que mudou no log (RN20)", async () => {
    await eventoService.atualizar(ctx(), "evento-1", { titulo: "Audiência remarcada" });

    expect(logs.registrar).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        acao: "atualizar",
        entidade: "evento",
        dados: expect.objectContaining({
          titulo: { antes: "Audiência", depois: "Audiência remarcada" },
        }),
      }),
      expect.anything()
    );
  });

  it("valida a modalidade contra o estado já gravado ao trocar só ela (RN32)", async () => {
    // Evento era presencial; virar online sem informar link é inválido.
    await expect(
      eventoService.atualizar(ctx(), "evento-1", { modalidade: "online" })
    ).rejects.toThrow(ModalidadeEventoInvalidaError);
  });

  it("limpa o campo da modalidade antiga ao trocar de modalidade (RN32)", async () => {
    await eventoService.atualizar(ctx(), "evento-1", {
      modalidade: "online",
      linkReuniao: "https://meet.example.com/z",
    });

    expect(repo.update).toHaveBeenCalledWith(
      "evento-1",
      expect.objectContaining({ modalidade: "online", local: null }),
      expect.anything()
    );
  });

  it("recusa deixar o evento vinculado a caso e cliente ao mesmo tempo (RN31)", async () => {
    repo.findById.mockResolvedValue(eventoFake({ casoId: "caso-1" }) as never);
    await expect(
      eventoService.atualizar(ctx(), "evento-1", { clienteId: "cliente-1" })
    ).rejects.toThrow(VinculoEventoExclusivoError);
  });

  it("permite trocar o vínculo de caso para cliente numa só chamada (RN31)", async () => {
    repo.findById.mockResolvedValue(eventoFake({ casoId: "caso-1" }) as never);
    clientes.obter.mockResolvedValue({ id: "cliente-1" } as never);

    await eventoService.atualizar(ctx(), "evento-1", { casoId: null, clienteId: "cliente-1" });

    expect(repo.update).toHaveBeenCalledWith(
      "evento-1",
      expect.objectContaining({ casoId: null, clienteId: "cliente-1" }),
      expect.anything()
    );
  });

  it("mantém o autor na lista ao substituir participantes (RN33)", async () => {
    await eventoService.atualizar(ctx(), "evento-1", {
      participanteMembroIds: [MEMBRO_OUTRO],
    });

    expect(repo.substituirParticipantes).toHaveBeenCalledWith(
      "evento-1",
      expect.arrayContaining([MEMBRO_ATOR, MEMBRO_OUTRO]),
      expect.anything()
    );
  });

  it("revalida o período quando só o fim é enviado (RN35)", async () => {
    await expect(
      eventoService.atualizar(ctx(), "evento-1", { fim: "2026-09-10T12:00:00.000Z" })
    ).rejects.toThrow(PeriodoEventoInvalidoError);
  });
});

describe("eventoService.excluir", () => {
  it("grava soft delete e log em vez de apagar a linha (RN34/RN20)", async () => {
    await eventoService.excluir(ctx(), "evento-1");

    expect(repo.softDelete).toHaveBeenCalledWith("evento-1", expect.anything());
    expect(logs.registrar).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ acao: "excluir", entidade: "evento" }),
      expect.anything()
    );
  });

  it("bloqueia membro padrão ao excluir evento de outra pessoa (RN34)", async () => {
    repo.findById.mockResolvedValue(eventoFake({ criadoPorMembroId: MEMBRO_OUTRO }) as never);

    await expect(eventoService.excluir(ctx("padrao"), "evento-1")).rejects.toThrow(
      PermissaoNegadaError
    );
    expect(repo.softDelete).not.toHaveBeenCalled();
  });
});

describe("eventoService.podeEditar", () => {
  it("resolve a permissão de edição por evento (RN34)", async () => {
    const proprio = eventoFake();
    const deOutro = eventoFake({ criadoPorMembroId: MEMBRO_OUTRO });

    expect(eventoService.podeEditar(ctx("padrao"), MEMBRO_ATOR, proprio)).toBe(true);
    expect(eventoService.podeEditar(ctx("padrao"), MEMBRO_ATOR, deOutro)).toBe(false);
    expect(eventoService.podeEditar(ctx("admin"), MEMBRO_ATOR, deOutro)).toBe(true);
  });
});
