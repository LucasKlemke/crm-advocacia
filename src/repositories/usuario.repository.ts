import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient, Usuario } from "@prisma/client";

type Db = Pick<PrismaClient, "usuario">;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const usuarioRepository = {
  async create(data: Prisma.UsuarioCreateInput, db: Db = prisma): Promise<Usuario> {
    return db.usuario.create({ data: { ...data, email: normalizeEmail(data.email) } });
  },

  async findByEmail(email: string, db: Db = prisma): Promise<Usuario | null> {
    return db.usuario.findUnique({ where: { email: normalizeEmail(email) } });
  },

  async findById(id: string, db: Db = prisma): Promise<Usuario | null> {
    return db.usuario.findUnique({ where: { id } });
  },

  async update(id: string, data: Prisma.UsuarioUpdateInput, db: Db = prisma): Promise<Usuario> {
    return db.usuario.update({
      where: { id },
      data: {
        ...data,
        ...(typeof data.email === "string" ? { email: normalizeEmail(data.email) } : {}),
      },
    });
  },

  async updateSenhaHash(id: string, senhaHash: string, db: Db = prisma): Promise<Usuario> {
    return db.usuario.update({ where: { id }, data: { senhaHash } });
  },
};
