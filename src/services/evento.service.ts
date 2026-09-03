import { prisma } from "@/lib/prisma";
import { eventoRepository, type EventoComRelacoes, type PeriodoEventos } from "@/repositories/evento.repository";
import { membroRepository } from "@/repositories/membro.repository";
import { casoService } from "@/services/caso.service";
import { clienteService } from "@/services/cliente.service";
import { logService } from "@/services/log.service";
import { PermissaoNegadaError } from "@/services/membro.service";
import { podeModerarEvento } from "@/lib/auth/permissoes";
import { calcularDiff } from "@/lib/utils/diff";
import { normalizarPeriodoEvento } from "@/lib/utils/evento-periodo";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { Evento, Membro, ModalidadeEvento } from "@prisma/client";

export { PermissaoNegadaError };

export class EventoNaoEncontradoError extends Error {
  constructor() {
    super("Evento não encontrado.");
    this.name = "EventoNaoEncontradoError";
  }
}

export class VinculoEventoExclusivoError extends Error {
  constructor() {
    super("Vincule o evento a um processo ou a um cliente, não aos dois.");
    this.name = "VinculoEventoExclusivoError";
  }
}

export class ModalidadeEventoInvalidaError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ModalidadeEventoInvalidaError";
  }
}

export class ParticipanteInvalidoError extends Error {
  constructor() {
    super("Participante inválido para este escritório.");
    this.name = "ParticipanteInvalidoError";
  }
}

// A sessão passou pelo getTenantContext, mas o membro pode ter sido removido entre a
// emissão do contexto e esta escrita — e todo evento precisa de um criador (FK).
export class MembroDaSessaoInvalidoError extends Error {
  constructor() {
    super("Seu vínculo com este escritório não está mais ativo.");
    this.name = "MembroDaSessaoInvalidoError";
  }
}

export interface DadosNovoEvento {
  titulo: string;
  descricao?: string | null;
  inicio: string;
  fim: string;
  diaInteiro?: boolean;
  modalidade: ModalidadeEvento;
  local?: string | null;
  linkReuniao?: string | null;
  casoId?: string | null;
  clienteId?: string | null;
  participanteMembroIds?: string[];
}

export type DadosEdicaoEvento = Partial<DadosNovoEvento>;

const CAMPOS_AUDITADOS = [
  "titulo",
  "descricao",
  "inicio",
  "fim",
  "diaInteiro",
  "modalidade",
  "local",
  "linkReuniao",
  "casoId",
  "clienteId",
] as const;

// Snapshot só com primitivos: `calcularDiff` compara por ===, e duas instâncias de Date
// com o mesmo instante nunca são iguais — sem isso todo PATCH registraria "início e fim
// mudaram" mesmo quando o usuário só corrigiu o título.
type EventoAuditado = {
  titulo: string;
  descricao: string | null;
  inicio: string;
  fim: string;
  diaInteiro: boolean;
  modalidade: ModalidadeEvento;
  local: string | null;
  linkReuniao: string | null;
  casoId: string | null;
  clienteId: string | null;
};

function paraAuditoria(evento: Evento): EventoAuditado {
  return {
    titulo: evento.titulo,
    descricao: evento.descricao,
    inicio: evento.inicio.toISOString(),
    fim: evento.fim.toISOString(),
    diaInteiro: evento.diaInteiro,
    modalidade: evento.modalidade,
    local: evento.local,
    linkReuniao: evento.linkReuniao,
    casoId: evento.casoId,
    clienteId: evento.clienteId,
  };
}

// RN32: cada modalidade tem um campo obrigatório e o da outra é sempre gravado como
// NULL — sem isso um evento que virou online continuaria exibindo o endereço antigo.
function resolverModalidade(
  modalidade: ModalidadeEvento,
  local: string | null,
  linkReuniao: string | null
): { modalidade: ModalidadeEvento; local: string | null; linkReuniao: string | null } {
  if (modalidade === "presencial") {
    if (!local) {
      throw new ModalidadeEventoInvalidaError("Informe o local do evento presencial.");
    }
    return { modalidade, local, linkReuniao: null };
  }
  if (!linkReuniao) {
    throw new ModalidadeEventoInvalidaError("Informe o link da reunião online.");
  }
  return { modalidade, local: null, linkReuniao };
}

function limpar(valor: string | null | undefined): string | null {
  return valor?.trim() || null;
}

async function membroDaSessao(ctx: TenantContext): Promise<Membro> {
  const membro = await membroRepository.findByUsuarioEEscritorio(ctx.usuarioId, ctx.escritorioId);
  if (!membro) {
    throw new MembroDaSessaoInvalidoError();
  }
  return membro;
}

// RN31: o vínculo é exclusivo e o alvo é sempre validado contra o tenant — casoService e
// clienteService já tratam registro de outro escritório como inexistente (RN19), então o
// 404 vem de graça e sem confirmar a existência do dado alheio.
async function validarVinculo(
  ctx: TenantContext,
  casoId: string | null,
  clienteId: string | null
): Promise<void> {
  if (casoId && clienteId) {
    throw new VinculoEventoExclusivoError();
  }
  if (casoId) {
    await casoService.obter(ctx, casoId);
  }
  if (clienteId) {
    await clienteService.obter(ctx, clienteId);
  }
}

// RN33: participantes são membros do próprio escritório, e o autor entra sempre — quem
// marcou o compromisso está nele por definição.
async function resolverParticipantes(
  ctx: TenantContext,
  autorMembroId: string,
  pedidos: string[] | undefined
): Promise<string[]> {
  const solicitados = new Set(pedidos ?? []);
  solicitados.add(autorMembroId);

  const membrosDoEscritorio = await membroRepository.listarPorEscritorio(ctx.escritorioId);
  const permitidos = new Set(membrosDoEscritorio.map((m) => m.id));
  for (const membroId of solicitados) {
    if (!permitidos.has(membroId)) {
      throw new ParticipanteInvalidoError();
    }
  }

  return [...solicitados];
}

export const eventoService = {
  async listarNoPeriodo(
    ctx: TenantContext,
    periodo: PeriodoEventos
  ): Promise<EventoComRelacoes[]> {
    return eventoRepository.listarNoPeriodo(ctx.escritorioId, periodo);
  },

  async obter(ctx: TenantContext, id: string): Promise<EventoComRelacoes> {
    const evento = await eventoRepository.findById(id);
    // Evento de outro escritório ou já excluído é tratado como inexistente — não
    // confirma a existência do registro (RN19/RN34).
    if (!evento || evento.escritorioId !== ctx.escritorioId || evento.softDeletedAt !== null) {
      throw new EventoNaoEncontradoError();
    }
    return evento;
  },

  // RN34: exposto para as rotas montarem `podeEditar` no DTO, para a UI não precisar
  // reimplementar a regra de moderação no cliente.
  podeEditar(ctx: TenantContext, membroId: string, evento: Evento): boolean {
    return podeModerarEvento(ctx.role, evento.criadoPorMembroId === membroId);
  },

  async membroAtual(ctx: TenantContext): Promise<Membro> {
    return membroDaSessao(ctx);
  },

  async criar(ctx: TenantContext, dados: DadosNovoEvento): Promise<Evento> {
    const autor = await membroDaSessao(ctx);

    const casoId = dados.casoId ?? null;
    const clienteId = dados.clienteId ?? null;
    await validarVinculo(ctx, casoId, clienteId);

    const diaInteiro = dados.diaInteiro ?? false;
    const periodo = normalizarPeriodoEvento(dados.inicio, dados.fim, diaInteiro);
    const modalidade = resolverModalidade(
      dados.modalidade,
      limpar(dados.local),
      limpar(dados.linkReuniao)
    );
    const participantes = await resolverParticipantes(
      ctx,
      autor.id,
      dados.participanteMembroIds
    );

    return prisma.$transaction(async (tx) => {
      const evento = await eventoRepository.create(
        {
          titulo: dados.titulo.trim(),
          descricao: limpar(dados.descricao),
          inicio: periodo.inicio,
          fim: periodo.fim,
          diaInteiro,
          ...modalidade,
          escritorio: { connect: { id: ctx.escritorioId } },
          criadoPor: { connect: { id: autor.id } },
          ...(casoId ? { caso: { connect: { id: casoId } } } : {}),
          ...(clienteId ? { cliente: { connect: { id: clienteId } } } : {}),
        },
        tx
      );

      await eventoRepository.substituirParticipantes(evento.id, participantes, tx);

      await logService.registrar(
        ctx,
        {
          acao: "criar",
          entidade: "evento",
          entidadeId: evento.id,
          resumo: `Evento ${evento.titulo} criado`,
        },
        tx
      );

      return evento;
    });
  },

  async atualizar(
    ctx: TenantContext,
    id: string,
    dados: DadosEdicaoEvento
  ): Promise<Evento> {
    const atual = await this.obter(ctx, id);
    const autor = await membroDaSessao(ctx);
    if (!this.podeEditar(ctx, autor.id, atual)) {
      throw new PermissaoNegadaError();
    }

    // Toda validação de RN é refeita sobre o estado resultante (gravado + payload), não
    // só sobre o payload: trocar apenas a modalidade, ou apenas o fim, tem que ser
    // conferido contra o que já está no banco.
    const casoId = dados.casoId !== undefined ? dados.casoId : atual.casoId;
    const clienteId = dados.clienteId !== undefined ? dados.clienteId : atual.clienteId;
    if (dados.casoId !== undefined || dados.clienteId !== undefined) {
      await validarVinculo(ctx, casoId, clienteId);
    }

    const diaInteiro = dados.diaInteiro ?? atual.diaInteiro;
    const periodo = normalizarPeriodoEvento(
      dados.inicio ?? atual.inicio,
      dados.fim ?? atual.fim,
      diaInteiro
    );
    const modalidade = resolverModalidade(
      dados.modalidade ?? atual.modalidade,
      dados.local !== undefined ? limpar(dados.local) : atual.local,
      dados.linkReuniao !== undefined ? limpar(dados.linkReuniao) : atual.linkReuniao
    );

    const mudancas: Partial<EventoAuditado> = {
      ...(dados.titulo !== undefined ? { titulo: dados.titulo.trim() } : {}),
      ...(dados.descricao !== undefined ? { descricao: limpar(dados.descricao) } : {}),
      inicio: periodo.inicio.toISOString(),
      fim: periodo.fim.toISOString(),
      diaInteiro,
      ...modalidade,
      casoId,
      clienteId,
    };

    const diff = calcularDiff(paraAuditoria(atual), mudancas, CAMPOS_AUDITADOS);
    const trocaParticipantes = dados.participanteMembroIds !== undefined;
    const participantes = trocaParticipantes
      ? await resolverParticipantes(ctx, atual.criadoPorMembroId, dados.participanteMembroIds)
      : [];

    // Nada mudou de fato: não toca no banco nem polui a auditoria com log vazio (RN20).
    if (!diff && !trocaParticipantes) {
      return atual;
    }

    return prisma.$transaction(async (tx) => {
      const evento = diff
        ? await eventoRepository.update(
            id,
            {
              ...(mudancas.titulo !== undefined ? { titulo: mudancas.titulo } : {}),
              ...(mudancas.descricao !== undefined ? { descricao: mudancas.descricao } : {}),
              inicio: periodo.inicio,
              fim: periodo.fim,
              diaInteiro,
              ...modalidade,
              casoId,
              clienteId,
            },
            tx
          )
        : atual;

      if (trocaParticipantes) {
        await eventoRepository.substituirParticipantes(id, participantes, tx);
      }

      await logService.registrar(
        ctx,
        {
          acao: "atualizar",
          entidade: "evento",
          entidadeId: id,
          resumo: `Evento ${evento.titulo} atualizado`,
          ...(diff ? { dados: diff } : {}),
        },
        tx
      );

      return evento;
    });
  },

  async excluir(ctx: TenantContext, id: string): Promise<void> {
    const atual = await this.obter(ctx, id);
    const autor = await membroDaSessao(ctx);
    if (!this.podeEditar(ctx, autor.id, atual)) {
      throw new PermissaoNegadaError();
    }

    await prisma.$transaction(async (tx) => {
      // RN34: nunca apaga a linha — o histórico de quem marcou e desmarcou fica.
      await eventoRepository.softDelete(id, tx);
      await logService.registrar(
        ctx,
        {
          acao: "excluir",
          entidade: "evento",
          entidadeId: id,
          resumo: `Evento ${atual.titulo} excluído`,
        },
        tx
      );
    });
  },
};
