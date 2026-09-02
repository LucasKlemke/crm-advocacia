import { prisma } from "@/lib/prisma";
import type {
  InstanciaWhatsapp,
  Prisma,
  PrismaClient,
  StatusInstanciaWhatsapp,
} from "@prisma/client";

type Db = Pick<PrismaClient, "instanciaWhatsapp">;

export interface FiltrosInstanciaWhatsapp {
  // Por padrão a listagem só enxerga instância ativa. `sincronizarTodas` é a única
  // chamadora que precisa das excluídas: é como ela detecta a que reapareceu na UAZAPI.
  incluirExcluidas?: boolean;
}

// Toda query nasce escopada ao escritório da sessão (RN19) — não existe método aqui
// que aceite consultar sem escritorioId.
export const instanciaWhatsappRepository = {
  async create(
    data: Prisma.InstanciaWhatsappCreateInput,
    db: Db = prisma
  ): Promise<InstanciaWhatsapp> {
    return db.instanciaWhatsapp.create({ data });
  },

  // Não filtra soft delete de propósito (igual a clienteRepository.findById): é por aqui
  // que o Service resolve o token de uma instância excluída, sem o qual as campanhas dela
  // perderiam o canal de controle com a UAZAPI.
  async findById(id: string, db: Db = prisma): Promise<InstanciaWhatsapp | null> {
    return db.instanciaWhatsapp.findUnique({ where: { id } });
  },

  // Também sem filtro: a excluída mantém o nome reservado (o @@unique abrange as duas),
  // então o pré-check de duplicidade precisa enxergá-la para explicar o 409 ao usuário.
  async findByNome(
    escritorioId: string,
    nome: string,
    db: Db = prisma
  ): Promise<InstanciaWhatsapp | null> {
    return db.instanciaWhatsapp.findUnique({
      where: { escritorioId_nome: { escritorioId, nome } },
    });
  },

  async listar(
    escritorioId: string,
    filtros: FiltrosInstanciaWhatsapp = {},
    db: Db = prisma
  ): Promise<InstanciaWhatsapp[]> {
    return db.instanciaWhatsapp.findMany({
      where: {
        escritorioId,
        ...(filtros.incluirExcluidas ? {} : { softDeletedAt: null }),
      },
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

  // Não existe delete físico aqui de propósito (RN30): a linha é a única cópia do
  // uazapi_token, e apagá-la deixaria toda campanha daquela instância sem canal de
  // controle. Sem filtro de escritorioId, igual findById/atualizarConexao — quem escopa é
  // o Service, que só deve chamar isto com um id já confirmado como deste tenant.
  async marcarExcluida(
    id: string,
    quando: Date,
    db: Db = prisma
  ): Promise<InstanciaWhatsapp> {
    return db.instanciaWhatsapp.update({ where: { id }, data: { softDeletedAt: quando } });
  },

  async restaurar(id: string, db: Db = prisma): Promise<InstanciaWhatsapp> {
    return db.instanciaWhatsapp.update({ where: { id }, data: { softDeletedAt: null } });
  },
};
