import { prisma } from "@dominio/lib/prisma";
import type { Campanha, Prisma, PrismaClient, StatusCampanha } from "@prisma/client";

type Db = Pick<PrismaClient, "campanha">;

// Campanha listada com o nome da instância que dispara — a listagem sempre mostra os
// dois juntos, e trazer só o nome evita arrastar o uazapiToken da instância pra cá.
const COM_INSTANCIA = {
  // softDeletedAt vem junto porque a instância excluída continua vinculada à campanha
  // (a exclusão é soft): a tela precisa distinguir "instância viva" de "instância excluída".
  instancia: { select: { id: true, nome: true, status: true, softDeletedAt: true } },
} satisfies Prisma.CampanhaInclude;

export type CampanhaComInstancia = Prisma.CampanhaGetPayload<{ include: typeof COM_INSTANCIA }>;

// Toda query de leitura de dados nasce escopada ao escritório da sessão (RN19). As únicas
// exceções devolvem ids para o sistema (tempo real), que relê cada campanha antes de agir.
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

  // Consultas do sistema (webhook/polling do tempo real), sem sessão e portanto sem
  // escritorioId: devolvem só ids, e quem as usa (campanhaService.*PeloSistema) relê
  // cada campanha e deriva o escritório da própria linha antes de escrever ou publicar.
  //
  // Campanhas que um webhook da instância pode ter afetado: as ainda ativas e as já
  // encerradas que mudaram desde `atualizadasDesde` — confirmações de entrega/leitura
  // continuam chegando depois que o envio termina. Mesmo filtro de instância viva (RN30).
  async listarIdsParaWebhook(
    instanciaId: string,
    filtro: { ativos: StatusCampanha[]; encerrados: StatusCampanha[]; atualizadasDesde: Date },
    db: Db = prisma
  ): Promise<string[]> {
    const campanhas = await db.campanha.findMany({
      where: {
        instanciaWhatsappId: instanciaId,
        instancia: { is: { softDeletedAt: null } },
        OR: [
          { status: { in: filtro.ativos } },
          { status: { in: filtro.encerrados }, updatedAt: { gte: filtro.atualizadasDesde } },
        ],
      },
      select: { id: true },
    });
    return campanhas.map((campanha) => campanha.id);
  },

  // `is` exige a instância vinculada: campanha sem instância (FK zerada) fica de fora,
  // assim como a de instância soft-deleted — não há o que sincronizar por elas.
  async listarIdsComInstanciaAtiva(status: StatusCampanha[], db: Db = prisma): Promise<string[]> {
    const campanhas = await db.campanha.findMany({
      where: { status: { in: status }, instancia: { is: { softDeletedAt: null } } },
      select: { id: true },
    });
    return campanhas.map((campanha) => campanha.id);
  },

  // Os itens somem junto por onDelete: Cascade — o log da exclusão (append-only) é o que
  // preserva o rastro da campanha.
  async delete(id: string, db: Db = prisma): Promise<Campanha> {
    return db.campanha.delete({ where: { id } });
  },
};
