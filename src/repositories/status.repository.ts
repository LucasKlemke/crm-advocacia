import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient, Status } from "@prisma/client";

type Db = Pick<PrismaClient, "status" | "caso">;

// Toda query nasce escopada ao escritório da sessão (RN19) — não existe método aqui
// que aceite consultar sem escritorioId.
export const statusRepository = {
  async create(data: Prisma.StatusCreateInput, db: Db = prisma): Promise<Status> {
    return db.status.create({ data });
  },

  async findById(id: string, db: Db = prisma): Promise<Status | null> {
    return db.status.findUnique({ where: { id } });
  },

  async findByNome(escritorioId: string, nome: string, db: Db = prisma): Promise<Status | null> {
    return db.status.findUnique({ where: { escritorioId_nome: { escritorioId, nome } } });
  },

  async listar(escritorioId: string, db: Db = prisma): Promise<Status[]> {
    return db.status.findMany({ where: { escritorioId }, orderBy: { ordem: "asc" } });
  },

  async update(id: string, data: Prisma.StatusUncheckedUpdateInput, db: Db = prisma): Promise<Status> {
    return db.status.update({ where: { id }, data });
  },

  // Checado antes de excluir para devolver um erro de domínio amigável em vez de deixar
  // estourar a violação de FK (onDelete: Restrict) do Caso.status.
  async contarCasos(id: string, db: Db = prisma): Promise<number> {
    return db.caso.count({ where: { statusId: id } });
  },

  async delete(id: string, db: Db = prisma): Promise<Status> {
    return db.status.delete({ where: { id } });
  },
};
