import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/repositories/usuario.repository";
import type { Convite, Prisma, PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "convite">;

// Convite pendente = linha existente. Aceitar/cancelar remove a linha (evita índice
// parcial que causaria drift no `migrate dev` — ver docs/database/migrations-prisma.md).
export const conviteRepository = {
  async create(data: Prisma.ConviteCreateInput, db: Db = prisma): Promise<Convite> {
    return db.convite.create({ data: { ...data, email: normalizeEmail(data.email) } });
  },

  async findById(id: string, db: Db = prisma): Promise<Convite | null> {
    return db.convite.findUnique({ where: { id } });
  },

  async findByEscritorioEEmail(
    escritorioId: string,
    email: string,
    db: Db = prisma
  ): Promise<Convite | null> {
    return db.convite.findUnique({
      where: { escritorioId_email: { escritorioId, email: normalizeEmail(email) } },
    });
  },

  async listarPorEmail(email: string, db: Db = prisma): Promise<Convite[]> {
    return db.convite.findMany({ where: { email: normalizeEmail(email) } });
  },

  async listarPorEscritorio(escritorioId: string, db: Db = prisma): Promise<Convite[]> {
    return db.convite.findMany({ where: { escritorioId }, orderBy: { createdAt: "asc" } });
  },

  async remover(id: string, db: Db = prisma): Promise<void> {
    await db.convite.delete({ where: { id } });
  },

  async removerTodosPorEmail(email: string, db: Db = prisma): Promise<void> {
    await db.convite.deleteMany({ where: { email: normalizeEmail(email) } });
  },
};
