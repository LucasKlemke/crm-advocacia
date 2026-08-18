import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient, Usuario } from "@prisma/client";

type Db = Pick<PrismaClient, "usuario">;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const usuarioRepository = {
  async create(data: Prisma.UsuarioCreateInput, db: Db = prisma): Promise<Usuario> {
    return db.usuario.create({ data: { ...data, email: normalizeEmail(data.email) } });
  },

  async findByEmail(email: string, db: Db = prisma): Promise<Usuario | null> {
    return db.usuario.findUnique({ where: { email: normalizeEmail(email) } });
  },
};
