import { prisma } from "@/lib/prisma";
import { casoRepository, type CasoComRelacoes, type FiltrosCaso } from "@/repositories/caso.repository";
import { statusRepository } from "@/repositories/status.repository";
import { membroRepository } from "@/repositories/membro.repository";
import { clienteService } from "@/services/cliente.service";
import { statusService } from "@/services/status.service";
import { logService } from "@/services/log.service";
import { calcularDiff } from "@/lib/utils/diff";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { Caso, Status } from "@prisma/client";

export class CasoNaoEncontradoError extends Error {
  constructor() {
    super("Caso não encontrado.");
    this.name = "CasoNaoEncontradoError";
  }
}

// RN06: caso precisa de um cliente ATIVO — um cliente soft-deletado não serve mais
// de âncora para um caso novo ou reatribuído.
export class ClienteInativoError extends Error {
  constructor() {
    super("Este cliente está inativo e não pode ser vinculado a um caso.");
    this.name = "ClienteInativoError";
  }
}

export class ResponsavelInvalidoError extends Error {
  constructor() {
    super("Responsável inválido para este escritório.");
    this.name = "ResponsavelInvalidoError";
  }
}

export interface DadosNovoCaso {
  titulo: string;
  clienteId: string;
  statusId: string;
  responsavelMembroId?: string | null;
  descricao?: string | null;
  valor?: number | null;
}

export type DadosEdicaoCaso = Partial<DadosNovoCaso>;

const CAMPOS_AUDITADOS = [
  "titulo",
  "clienteId",
  "statusId",
  "responsavelMembroId",
  "descricao",
  "valor",
] as const;

const CASOS_POR_COLUNA_KANBAN = 20;

// Cliente precisa existir no tenant (clienteService.obter já garante isso) e estar
// ativo — um cliente desativado não pode ganhar caso novo nem ser realocado.
async function validarCliente(ctx: TenantContext, clienteId: string): Promise<void> {
  const cliente = await clienteService.obter(ctx, clienteId);
  if (cliente.softDeletedAt !== null) {
    throw new ClienteInativoError();
  }
}

async function validarResponsavel(ctx: TenantContext, responsavelMembroId: string): Promise<void> {
  const membro = await membroRepository.findById(responsavelMembroId);
  if (!membro || membro.escritorioId !== ctx.escritorioId) {
    throw new ResponsavelInvalidoError();
  }
}

// Casos são o trabalho diário do escritório: qualquer papel (inclusive padrao)
// pode criar, editar e arquivar. A única barreira é o tenant (RN19).
export const casoService = {
  async listar(ctx: TenantContext, filtros: FiltrosCaso = {}) {
    const [casos, total] = await Promise.all([
      casoRepository.listar(ctx.escritorioId, filtros),
      casoRepository.contar(ctx.escritorioId, filtros),
    ]);
    return { casos, total };
  },

  // Uma coluna por Status do escritório (ordenadas por `ordem`), com o total real
  // da coluna e uma primeira página de casos para o card não carregar tudo de uma vez.
  async listarKanban(
    ctx: TenantContext,
    filtros: Omit<FiltrosCaso, "statusIds" | "skip" | "take"> = {}
  ): Promise<{ status: Status; total: number; casos: CasoComRelacoes[] }[]> {
    const status = await statusRepository.listar(ctx.escritorioId);

    return Promise.all(
      status.map(async (coluna) => {
        const filtrosColuna: FiltrosCaso = { ...filtros, statusIds: [coluna.id] };
        const [casos, total] = await Promise.all([
          casoRepository.listar(ctx.escritorioId, { ...filtrosColuna, take: CASOS_POR_COLUNA_KANBAN }),
          casoRepository.contar(ctx.escritorioId, filtrosColuna),
        ]);
        return { status: coluna, total, casos };
      })
    );
  },

  async obter(ctx: TenantContext, id: string): Promise<CasoComRelacoes> {
    const caso = await casoRepository.findById(id);
    // Caso de outro escritório é tratado como inexistente — não confirma a existência.
    if (!caso || caso.escritorioId !== ctx.escritorioId) {
      throw new CasoNaoEncontradoError();
    }
    return caso;
  },

  async criar(ctx: TenantContext, dados: DadosNovoCaso): Promise<Caso> {
    await validarCliente(ctx, dados.clienteId);
    await statusService.obter(ctx, dados.statusId);
    if (dados.responsavelMembroId) {
      await validarResponsavel(ctx, dados.responsavelMembroId);
    }

    return prisma.$transaction(async (tx) => {
      const caso = await casoRepository.create(
        {
          titulo: dados.titulo.trim(),
          descricao: dados.descricao?.trim() || null,
          valor: dados.valor ?? null,
          escritorio: { connect: { id: ctx.escritorioId } },
          cliente: { connect: { id: dados.clienteId } },
          status: { connect: { id: dados.statusId } },
          ...(dados.responsavelMembroId
            ? { responsavel: { connect: { id: dados.responsavelMembroId } } }
            : {}),
        },
        tx
      );

      await logService.registrar(
        ctx,
        {
          acao: "criar",
          entidade: "caso",
          entidadeId: caso.id,
          resumo: `Caso ${caso.titulo} criado`,
        },
        tx
      );

      return caso;
    });
  },

  async atualizar(ctx: TenantContext, id: string, dados: DadosEdicaoCaso): Promise<Caso> {
    const atual = await this.obter(ctx, id);

    if (dados.clienteId !== undefined) {
      await validarCliente(ctx, dados.clienteId);
    }
    if (dados.statusId !== undefined) {
      await statusService.obter(ctx, dados.statusId);
    }
    if (dados.responsavelMembroId) {
      await validarResponsavel(ctx, dados.responsavelMembroId);
    }

    const mudancas: DadosEdicaoCaso = {
      ...(dados.titulo !== undefined ? { titulo: dados.titulo.trim() } : {}),
      ...(dados.clienteId !== undefined ? { clienteId: dados.clienteId } : {}),
      ...(dados.statusId !== undefined ? { statusId: dados.statusId } : {}),
      ...(dados.responsavelMembroId !== undefined
        ? { responsavelMembroId: dados.responsavelMembroId }
        : {}),
      ...(dados.descricao !== undefined ? { descricao: dados.descricao?.trim() || null } : {}),
      ...(dados.valor !== undefined ? { valor: dados.valor } : {}),
    };

    // `valor` chega do Prisma como Decimal — comparado como número para calcularDiff
    // não acusar mudança quando o valor numérico é o mesmo.
    const atualComparavel = { ...atual, valor: atual.valor === null ? null : Number(atual.valor) };
    const diff = calcularDiff(atualComparavel, mudancas, CAMPOS_AUDITADOS);
    // Nada mudou de fato: não toca no banco nem polui a auditoria com log vazio.
    if (!diff) {
      return atual;
    }

    return prisma.$transaction(async (tx) => {
      const caso = await casoRepository.update(
        id,
        {
          ...(mudancas.titulo !== undefined ? { titulo: mudancas.titulo } : {}),
          ...(mudancas.clienteId !== undefined
            ? { cliente: { connect: { id: mudancas.clienteId } } }
            : {}),
          ...(mudancas.statusId !== undefined
            ? { status: { connect: { id: mudancas.statusId } } }
            : {}),
          ...(mudancas.responsavelMembroId !== undefined
            ? mudancas.responsavelMembroId
              ? { responsavel: { connect: { id: mudancas.responsavelMembroId } } }
              : { responsavel: { disconnect: true } }
            : {}),
          ...(mudancas.descricao !== undefined ? { descricao: mudancas.descricao } : {}),
          ...(mudancas.valor !== undefined ? { valor: mudancas.valor } : {}),
        },
        tx
      );

      await logService.registrar(
        ctx,
        {
          acao: "atualizar",
          entidade: "caso",
          entidadeId: caso.id,
          resumo: `Caso ${caso.titulo} atualizado`,
          dados: diff,
        },
        tx
      );

      return caso;
    });
  },

  // Arquivar/desarquivar não são exclusões: o caso continua existindo no histórico
  // (RN08/RN09), só sai da visão padrão do kanban/tabela.
  async arquivar(ctx: TenantContext, id: string): Promise<Caso> {
    const atual = await this.obter(ctx, id);
    if (atual.arquivado) {
      return atual;
    }

    return prisma.$transaction(async (tx) => {
      const caso = await casoRepository.update(id, { arquivado: true }, tx);
      await logService.registrar(
        ctx,
        {
          acao: "atualizar",
          entidade: "caso",
          entidadeId: caso.id,
          resumo: `Caso ${caso.titulo} arquivado`,
        },
        tx
      );
      return caso;
    });
  },

  async desarquivar(ctx: TenantContext, id: string): Promise<Caso> {
    const atual = await this.obter(ctx, id);
    if (!atual.arquivado) {
      return atual;
    }

    return prisma.$transaction(async (tx) => {
      const caso = await casoRepository.update(id, { arquivado: false }, tx);
      await logService.registrar(
        ctx,
        {
          acao: "atualizar",
          entidade: "caso",
          entidadeId: caso.id,
          resumo: `Caso ${caso.titulo} desarquivado`,
        },
        tx
      );
      return caso;
    });
  },
};
