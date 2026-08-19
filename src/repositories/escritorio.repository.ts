import { prisma } from "@/lib/prisma";
import type { Escritorio, Prisma, PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "escritorio">;

export const escritorioRepository = {
  async create(data: Prisma.EscritorioCreateInput, db: Db = prisma): Promise<Escritorio> {
    return db.escritorio.create({ data });
  },

  async findById(id: string, db: Db = prisma): Promise<Escritorio | null> {
    return db.escritorio.findUnique({ where: { id } });
  },

  async update(
    id: string,
    data: Prisma.EscritorioUpdateInput,
    db: Db = prisma
  ): Promise<Escritorio> {
    return db.escritorio.update({ where: { id }, data });
  },
};
