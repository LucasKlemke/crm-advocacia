import { prisma } from "@/lib/prisma";
import type { Membro, Prisma, PrismaClient, RoleMembro } from "@prisma/client";

type Db = Pick<PrismaClient, "membro">;

export const membroRepository = {
  async create(data: Prisma.MembroCreateInput, db: Db = prisma): Promise<Membro> {
    return db.membro.create({ data });
  },

  async findById(id: string, db: Db = prisma): Promise<Membro | null> {
    return db.membro.findUnique({ where: { id } });
  },

  async findByUsuarioEEscritorio(
    usuarioId: string,
    escritorioId: string,
    db: Db = prisma
  ): Promise<Membro | null> {
    return db.membro.findUnique({
      where: { usuarioId_escritorioId: { usuarioId, escritorioId } },
    });
  },

  // Membership mais antiga primeiro — usada para resolver o escritório inicial da sessão.
  async listarPorUsuario(usuarioId: string, db: Db = prisma): Promise<Membro[]> {
    return db.membro.findMany({ where: { usuarioId }, orderBy: { createdAt: "asc" } });
  },

  async listarComEscritorioPorUsuario(usuarioId: string, db: Db = prisma) {
    return db.membro.findMany({
      where: { usuarioId },
      orderBy: { createdAt: "asc" },
      include: { escritorio: true },
    });
  },

  async listarPorEscritorio(escritorioId: string, db: Db = prisma): Promise<Membro[]> {
    return db.membro.findMany({ where: { escritorioId }, orderBy: { createdAt: "asc" } });
  },

  async listarComUsuarioPorEscritorio(escritorioId: string, db: Db = prisma) {
    return db.membro.findMany({
      where: { escritorioId },
      orderBy: { createdAt: "asc" },
      include: { usuario: true },
    });
  },

  async contarOwners(escritorioId: string, db: Db = prisma): Promise<number> {
    return db.membro.count({ where: { escritorioId, role: "owner" } });
  },

  async atualizarRole(id: string, role: RoleMembro, db: Db = prisma): Promise<Membro> {
    return db.membro.update({ where: { id }, data: { role } });
  },

  async remover(id: string, db: Db = prisma): Promise<void> {
    await db.membro.delete({ where: { id } });
  },
};
