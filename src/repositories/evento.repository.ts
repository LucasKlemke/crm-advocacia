import { prisma } from "@/lib/prisma";
import { USUARIO_PUBLICO_SELECT } from "@/repositories/membro.repository";
import type { Evento, Prisma, PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "evento" | "eventoParticipante">;

export interface PeriodoEventos {
  inicio: Date;
  fim: Date;
}

// Tudo que a agenda precisa para desenhar um evento sem uma segunda consulta por linha.
// `usuario` vem pelo select público: sem ele o Usuario inteiro (senhaHash incluído)
// vazaria no JSON de resposta, como já aconteceu em CASO_INCLUDE.
export const EVENTO_INCLUDE = {
  cliente: { select: { id: true, nome: true, cpf: true } },
  caso: {
    select: {
      id: true,
      numeroProcesso: true,
      cliente: { select: { id: true, nome: true } },
      tipoProcesso: { select: { id: true, nome: true, cor: true, icone: true } },
    },
  },
  criadoPor: { select: { id: true, usuario: { select: USUARIO_PUBLICO_SELECT } } },
  participantes: {
    select: { membroId: true, membro: { select: { usuario: { select: USUARIO_PUBLICO_SELECT } } } },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.EventoInclude;

export type EventoComRelacoes = Prisma.EventoGetPayload<{ include: typeof EVENTO_INCLUDE }>;

// Toda query nasce escopada ao escritório da sessão (RN19), e nenhuma listagem devolve
// evento com soft delete (RN34) — quem precisa do apagado usa findById direto.
export const eventoRepository = {
  async create(data: Prisma.EventoCreateInput, db: Db = prisma): Promise<Evento> {
    return db.evento.create({ data });
  },

  async findById(id: string, db: Db = prisma): Promise<EventoComRelacoes | null> {
    return db.evento.findUnique({ where: { id }, include: EVENTO_INCLUDE });
  },

  // Sobreposição com a janela, não contenção: um evento que começa antes e termina
  // dentro (ou que atravessa a janela inteira) precisa aparecer no calendário.
  async listarNoPeriodo(
    escritorioId: string,
    periodo: PeriodoEventos,
    db: Db = prisma
  ): Promise<EventoComRelacoes[]> {
    return db.evento.findMany({
      where: {
        escritorioId,
        softDeletedAt: null,
        inicio: { lt: periodo.fim },
        fim: { gt: periodo.inicio },
      },
      include: EVENTO_INCLUDE,
      orderBy: [{ inicio: "asc" }, { createdAt: "asc" }],
    });
  },

  async update(
    id: string,
    data: Prisma.EventoUncheckedUpdateInput,
    db: Db = prisma
  ): Promise<Evento> {
    return db.evento.update({ where: { id }, data });
  },

  // RN34: excluir é reversível por definição — a linha fica, marcada.
  async softDelete(id: string, db: Db = prisma): Promise<Evento> {
    return db.evento.update({ where: { id }, data: { softDeletedAt: new Date() } });
  },

  // Substitui o conjunto inteiro em vez de diferenciar entradas e saídas: a edição de
  // participantes na UI é sempre "esta é a lista final", e o delete+insert dentro da
  // transação do Service torna a operação idempotente.
  async substituirParticipantes(
    eventoId: string,
    membroIds: string[],
    db: Db = prisma
  ): Promise<void> {
    await db.eventoParticipante.deleteMany({ where: { eventoId } });
    if (membroIds.length === 0) {
      return;
    }
    await db.eventoParticipante.createMany({
      data: [...new Set(membroIds)].map((membroId) => ({ eventoId, membroId })),
    });
  },

  async contarPorCaso(casoId: string, db: Db = prisma): Promise<number> {
    return db.evento.count({ where: { casoId, softDeletedAt: null } });
  },

  async contarPorCliente(clienteId: string, db: Db = prisma): Promise<number> {
    return db.evento.count({ where: { clienteId, softDeletedAt: null } });
  },
};
