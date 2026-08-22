import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient, TipoProcesso } from "@prisma/client";

type Db = Pick<PrismaClient, "tipoProcesso" | "caso">;

// Toda query nasce escopada ao escritório da sessão (RN19) — não existe método aqui
// que aceite consultar sem escritorioId.
export const tipoProcessoRepository = {
  async create(data: Prisma.TipoProcessoCreateInput, db: Db = prisma): Promise<TipoProcesso> {
    return db.tipoProcesso.create({ data });
  },

  async findById(id: string, db: Db = prisma): Promise<TipoProcesso | null> {
    return db.tipoProcesso.findUnique({ where: { id } });
  },

  async findByNome(
    escritorioId: string,
    nome: string,
    db: Db = prisma
  ): Promise<TipoProcesso | null> {
    return db.tipoProcesso.findUnique({ where: { escritorioId_nome: { escritorioId, nome } } });
  },

  async listar(escritorioId: string, db: Db = prisma): Promise<TipoProcesso[]> {
    return db.tipoProcesso.findMany({ where: { escritorioId }, orderBy: { ordem: "asc" } });
  },

  async update(
    id: string,
    data: Prisma.TipoProcessoUncheckedUpdateInput,
    db: Db = prisma
  ): Promise<TipoProcesso> {
    return db.tipoProcesso.update({ where: { id }, data });
  },

  // Checado antes de excluir para devolver um erro de domínio amigável em vez de deixar
  // estourar a violação de FK (onDelete: Restrict) do Caso.tipoProcesso.
  async contarCasos(id: string, db: Db = prisma): Promise<number> {
    return db.caso.count({ where: { tipoProcessoId: id } });
  },

  async delete(id: string, db: Db = prisma): Promise<TipoProcesso> {
    return db.tipoProcesso.delete({ where: { id } });
  },
};
