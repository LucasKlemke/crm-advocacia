import { prisma } from "@/lib/prisma";
import type { CampanhaItem, Prisma, PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "campanhaItem">;

// Itens de campanha nascem em lote (uma linha do CSV = um item) e nunca são alterados
// depois: são o registro do que foi entregue à UAZAPI. Por isso só há create/leitura.
export const campanhaItemRepository = {
  async createMany(
    data: Prisma.CampanhaItemCreateManyInput[],
    db: Db = prisma
  ): Promise<number> {
    const { count } = await db.campanhaItem.createMany({ data });
    return count;
  },

  async listarPorCampanha(
    campanhaId: string,
    { pular, limite }: { pular: number; limite: number },
    db: Db = prisma
  ): Promise<CampanhaItem[]> {
    return db.campanhaItem.findMany({
      where: { campanhaId },
      orderBy: { linha: "asc" },
      skip: pular,
      take: limite,
    });
  },

  async contarPorCampanha(campanhaId: string, db: Db = prisma): Promise<number> {
    return db.campanhaItem.count({ where: { campanhaId } });
  },
};
