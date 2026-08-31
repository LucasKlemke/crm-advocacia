import { prisma } from "@/lib/prisma";
import type {
  InstanciaWhatsapp,
  Prisma,
  PrismaClient,
  StatusInstanciaWhatsapp,
} from "@prisma/client";

type Db = Pick<PrismaClient, "instanciaWhatsapp">;

// Toda query nasce escopada ao escritório da sessão (RN19) — não existe método aqui
// que aceite consultar sem escritorioId.
export const instanciaWhatsappRepository = {
  async create(
    data: Prisma.InstanciaWhatsappCreateInput,
    db: Db = prisma
  ): Promise<InstanciaWhatsapp> {
    return db.instanciaWhatsapp.create({ data });
  },

  async findById(id: string, db: Db = prisma): Promise<InstanciaWhatsapp | null> {
    return db.instanciaWhatsapp.findUnique({ where: { id } });
  },

  async findByNome(
    escritorioId: string,
    nome: string,
    db: Db = prisma
  ): Promise<InstanciaWhatsapp | null> {
    return db.instanciaWhatsapp.findUnique({
      where: { escritorioId_nome: { escritorioId, nome } },
    });
  },

  async listar(escritorioId: string, db: Db = prisma): Promise<InstanciaWhatsapp[]> {
    return db.instanciaWhatsapp.findMany({
      where: { escritorioId },
      orderBy: { createdAt: "asc" },
    });
  },

  async atualizarConexao(
    id: string,
    data: {
      status: StatusInstanciaWhatsapp;
      numeroConectado?: string | null;
      fotoPerfilUrl?: string | null;
    },
    db: Db = prisma
  ): Promise<InstanciaWhatsapp> {
    return db.instanciaWhatsapp.update({ where: { id }, data });
  },
};
