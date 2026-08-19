import { prisma } from "@/lib/prisma";
import type { EntidadeLog, Log, Prisma, PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "log">;

// Trilha de auditoria é append-only: nenhum update/delete é exposto aqui, de propósito.
export const logRepository = {
  async create(data: Prisma.LogCreateInput, db: Db = prisma): Promise<Log> {
    return db.log.create({ data });
  },

  async listarPorEntidade(
    escritorioId: string,
    entidade: EntidadeLog,
    entidadeId: string,
    db: Db = prisma
  ) {
    return db.log.findMany({
      where: { escritorioId, entidade, entidadeId },
      orderBy: { createdAt: "desc" },
      include: { usuario: { select: { id: true, nome: true } } },
    });
  },

  async listarPorEscritorio(escritorioId: string, take = 50, db: Db = prisma) {
    return db.log.findMany({
      where: { escritorioId },
      orderBy: { createdAt: "desc" },
      take,
      include: { usuario: { select: { id: true, nome: true } } },
    });
  },
};
