import { prisma } from "@/lib/prisma";
import type { PrismaClient, TipoStatus } from "@prisma/client";

type Db = Pick<PrismaClient, "tipoStatus">;

// Tabela de referência global (sem escritorioId) — seedada via migration e somente
// leitura pela aplicação; não existe método de escrita aqui de propósito.
export const tipoStatusRepository = {
  async listar(db: Db = prisma): Promise<TipoStatus[]> {
    return db.tipoStatus.findMany({ orderBy: { ordem: "asc" } });
  },

  async findByChave(chave: string, db: Db = prisma): Promise<TipoStatus | null> {
    return db.tipoStatus.findUnique({ where: { chave } });
  },

  async findById(id: string, db: Db = prisma): Promise<TipoStatus | null> {
    return db.tipoStatus.findUnique({ where: { id } });
  },
};
