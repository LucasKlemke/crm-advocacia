import { prisma } from "@/lib/prisma";
import type { Caso, Prisma, PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "caso">;

// Sentinela usada em `responsavelIds` para pedir os casos sem responsável — não é um
// id de Membro de verdade, então nunca colide com um uuid gerado pelo banco.
export const SEM_RESPONSAVEL = "sem-responsavel";

export interface FiltrosCaso {
  busca?: string;
  statusIds?: string[];
  tipoStatusIds?: string[];
  clienteIds?: string[];
  responsavelIds?: string[];
  dataInicio?: Date;
  dataFim?: Date;
  arquivado?: boolean;
  skip?: number;
  take?: number;
}

export const CASO_INCLUDE = {
  cliente: true,
  status: true,
  responsavel: { include: { usuario: true } },
} satisfies Prisma.CasoInclude;

export type CasoComRelacoes = Prisma.CasoGetPayload<{ include: typeof CASO_INCLUDE }>;

// Toda query nasce escopada ao escritório da sessão (RN19) — não existe método aqui
// que aceite consultar sem escritorioId.
function where(escritorioId: string, filtros: FiltrosCaso): Prisma.CasoWhereInput {
  const busca = filtros.busca?.trim();

  const responsavelFiltro = (() => {
    if (!filtros.responsavelIds || filtros.responsavelIds.length === 0) return undefined;
    const semResponsavel = filtros.responsavelIds.includes(SEM_RESPONSAVEL);
    const ids = filtros.responsavelIds.filter((id) => id !== SEM_RESPONSAVEL);

    if (semResponsavel && ids.length > 0) {
      return { OR: [{ responsavelMembroId: null }, { responsavelMembroId: { in: ids } }] };
    }
    if (semResponsavel) {
      return { responsavelMembroId: null };
    }
    return { responsavelMembroId: { in: ids } };
  })();

  return {
    escritorioId,
    arquivado: filtros.arquivado ?? false,
    ...(busca
      ? {
          OR: [
            { titulo: { contains: busca, mode: "insensitive" } },
            { descricao: { contains: busca, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(filtros.statusIds && filtros.statusIds.length > 0
      ? { statusId: { in: filtros.statusIds } }
      : {}),
    ...(filtros.tipoStatusIds && filtros.tipoStatusIds.length > 0
      ? { status: { tipoStatusId: { in: filtros.tipoStatusIds } } }
      : {}),
    ...(filtros.clienteIds && filtros.clienteIds.length > 0
      ? { clienteId: { in: filtros.clienteIds } }
      : {}),
    ...(responsavelFiltro ?? {}),
    ...(filtros.dataInicio || filtros.dataFim
      ? {
          createdAt: {
            ...(filtros.dataInicio ? { gte: filtros.dataInicio } : {}),
            ...(filtros.dataFim ? { lte: filtros.dataFim } : {}),
          },
        }
      : {}),
  };
}

export const casoRepository = {
  async create(data: Prisma.CasoCreateInput, db: Db = prisma): Promise<Caso> {
    return db.caso.create({ data });
  },

  async findById(id: string, db: Db = prisma): Promise<CasoComRelacoes | null> {
    return db.caso.findUnique({ where: { id }, include: CASO_INCLUDE });
  },

  async listar(
    escritorioId: string,
    filtros: FiltrosCaso = {},
    db: Db = prisma
  ): Promise<CasoComRelacoes[]> {
    return db.caso.findMany({
      where: where(escritorioId, filtros),
      include: CASO_INCLUDE,
      orderBy: { updatedAt: "desc" },
      skip: filtros.skip,
      take: filtros.take,
    });
  },

  async contar(escritorioId: string, filtros: FiltrosCaso = {}, db: Db = prisma): Promise<number> {
    return db.caso.count({ where: where(escritorioId, filtros) });
  },

  async update(id: string, data: Prisma.CasoUpdateInput, db: Db = prisma): Promise<Caso> {
    return db.caso.update({ where: { id }, data });
  },
};
