import { prisma } from "@/lib/prisma";
import type { Comentario, EscopoComentario, Prisma, PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "comentario">;

export const comentarioRepository = {
  async create(data: Prisma.ComentarioCreateInput, db: Db = prisma): Promise<Comentario> {
    return db.comentario.create({ data });
  },

  async findById(id: string, db: Db = prisma): Promise<Comentario | null> {
    return db.comentario.findUnique({ where: { id } });
  },

  // Mais recente primeiro, com o autor embutido para a timeline não fazer N+1.
  async listarPorEscopo(
    escritorioId: string,
    escopo: EscopoComentario,
    escopoId: string,
    db: Db = prisma
  ) {
    return db.comentario.findMany({
      where: { escritorioId, escopo, escopoId, softDeletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { autor: { select: { id: true, nome: true, email: true } } },
    });
  },

  async update(
    id: string,
    data: Prisma.ComentarioUpdateInput,
    db: Db = prisma
  ): Promise<Comentario> {
    return db.comentario.update({ where: { id }, data });
  },

  async marcarExcluido(id: string, quando: Date, db: Db = prisma): Promise<Comentario> {
    return db.comentario.update({ where: { id }, data: { softDeletedAt: quando } });
  },
};
