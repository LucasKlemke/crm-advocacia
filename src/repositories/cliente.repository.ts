import { prisma } from "@/lib/prisma";
import type { Cliente, Prisma, PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "cliente">;

export interface FiltrosCliente {
  busca?: string;
  incluirExcluidos?: boolean;
  skip?: number;
  take?: number;
}

// Toda query nasce escopada ao escritório da sessão (RN19) — não existe método aqui
// que aceite consultar sem escritorioId.
function where(escritorioId: string, filtros: FiltrosCliente): Prisma.ClienteWhereInput {
  const busca = filtros.busca?.trim();
  return {
    escritorioId,
    ...(filtros.incluirExcluidos ? {} : { softDeletedAt: null }),
    ...(busca
      ? {
          OR: [
            { nome: { contains: busca, mode: "insensitive" } },
            { cpf: { contains: busca.replace(/\D/g, "") || busca } },
            { email: { contains: busca, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export const clienteRepository = {
  async create(data: Prisma.ClienteCreateInput, db: Db = prisma): Promise<Cliente> {
    return db.cliente.create({ data });
  },

  async findById(id: string, db: Db = prisma): Promise<Cliente | null> {
    return db.cliente.findUnique({ where: { id } });
  },

  async findByCpf(escritorioId: string, cpf: string, db: Db = prisma): Promise<Cliente | null> {
    return db.cliente.findUnique({ where: { escritorioId_cpf: { escritorioId, cpf } } });
  },

  async listar(
    escritorioId: string,
    filtros: FiltrosCliente = {},
    db: Db = prisma
  ): Promise<Cliente[]> {
    return db.cliente.findMany({
      where: where(escritorioId, filtros),
      orderBy: { nome: "asc" },
      skip: filtros.skip,
      take: filtros.take,
    });
  },

  async contar(
    escritorioId: string,
    filtros: FiltrosCliente = {},
    db: Db = prisma
  ): Promise<number> {
    return db.cliente.count({ where: where(escritorioId, filtros) });
  },

  // Só devolve os ids que pertencem ao escritório — é o filtro que impede uma ação
  // em lote de tocar cliente de outro tenant a partir de ids forjados no client.
  async listarPorIds(
    escritorioId: string,
    ids: string[],
    db: Db = prisma
  ): Promise<Cliente[]> {
    return db.cliente.findMany({ where: { escritorioId, id: { in: ids } } });
  },

  async update(id: string, data: Prisma.ClienteUpdateInput, db: Db = prisma): Promise<Cliente> {
    return db.cliente.update({ where: { id }, data });
  },

  async marcarExcluidos(ids: string[], quando: Date, db: Db = prisma): Promise<number> {
    const { count } = await db.cliente.updateMany({
      where: { id: { in: ids } },
      data: { softDeletedAt: quando },
    });
    return count;
  },

  async restaurar(ids: string[], db: Db = prisma): Promise<number> {
    const { count } = await db.cliente.updateMany({
      where: { id: { in: ids } },
      data: { softDeletedAt: null },
    });
    return count;
  },
};
