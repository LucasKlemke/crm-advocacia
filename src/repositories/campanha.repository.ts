import { prisma } from "@/lib/prisma";
import type { Campanha, Prisma, PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "campanha">;

// Campanha listada com o nome da instância que dispara — a listagem sempre mostra os
// dois juntos, e trazer só o nome evita arrastar o uazapiToken da instância pra cá.
const COM_INSTANCIA = {
  instancia: { select: { id: true, nome: true, status: true } },
} satisfies Prisma.CampanhaInclude;

export type CampanhaComInstancia = Prisma.CampanhaGetPayload<{ include: typeof COM_INSTANCIA }>;

// Toda query nasce escopada ao escritório da sessão (RN19) — não existe método aqui
// que aceite consultar sem escritorioId.
export const campanhaRepository = {
  async create(data: Prisma.CampanhaCreateInput, db: Db = prisma): Promise<Campanha> {
    return db.campanha.create({ data });
  },

  // Sem filtro de escritorioId, igual ao findById de instancia-whatsapp — quem escopa é
  // o Service, que compara o escritorioId antes de devolver qualquer coisa ao chamador.
  async findById(id: string, db: Db = prisma): Promise<CampanhaComInstancia | null> {
    return db.campanha.findUnique({ where: { id }, include: COM_INSTANCIA });
  },

  async listar(escritorioId: string, db: Db = prisma): Promise<CampanhaComInstancia[]> {
    return db.campanha.findMany({
      where: { escritorioId },
      include: COM_INSTANCIA,
      orderBy: { createdAt: "desc" },
    });
  },

  async update(
    id: string,
    data: Prisma.CampanhaUncheckedUpdateInput,
    db: Db = prisma
  ): Promise<Campanha> {
    return db.campanha.update({ where: { id }, data });
  },

  // Os itens somem junto por onDelete: Cascade — o log da exclusão (append-only) é o que
  // preserva o rastro da campanha.
  async delete(id: string, db: Db = prisma): Promise<Campanha> {
    return db.campanha.delete({ where: { id } });
  },
};
