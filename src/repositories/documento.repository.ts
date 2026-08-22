import { prisma } from "@/lib/prisma";
import type { Documento, EscopoDocumento, Prisma, PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "documento">;

export const documentoRepository = {
  async create(data: Prisma.DocumentoCreateInput, db: Db = prisma): Promise<Documento> {
    return db.documento.create({ data });
  },

  async findById(id: string, db: Db = prisma): Promise<Documento | null> {
    return db.documento.findUnique({ where: { id } });
  },

  async listarPorEscopo(
    escritorioId: string,
    escopo: EscopoDocumento,
    escopoId: string,
    db: Db = prisma
  ): Promise<Documento[]> {
    return db.documento.findMany({
      where: { escritorioId, escopo, escopoId, softDeletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  },

  // Mesma ideia do comentarioRepository.contarPorEscopos: contagem em lote para os
  // cards do kanban, já que `escopoId` não é uma FK que o Prisma saiba agregar.
  async contarPorEscopos(
    escritorioId: string,
    escopo: EscopoDocumento,
    escopoIds: string[],
    db: Db = prisma
  ): Promise<Record<string, number>> {
    if (escopoIds.length === 0) return {};
    const grupos = await db.documento.groupBy({
      by: ["escopoId"],
      where: { escritorioId, escopo, escopoId: { in: escopoIds }, softDeletedAt: null },
      _count: { _all: true },
    });
    return Object.fromEntries(grupos.map((g) => [g.escopoId, g._count._all]));
  },

  async marcarExcluido(id: string, quando: Date, db: Db = prisma): Promise<Documento> {
    return db.documento.update({ where: { id }, data: { softDeletedAt: quando } });
  },

  // Renomear é só metadado: a storageKey (e o objeto no S3) não mudam de lugar.
  async atualizarNome(id: string, nomeOriginal: string, db: Db = prisma): Promise<Documento> {
    return db.documento.update({ where: { id }, data: { nomeOriginal } });
  },
};
