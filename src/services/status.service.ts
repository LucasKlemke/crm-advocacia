import { prisma } from "@/lib/prisma";
import { statusRepository } from "@/repositories/status.repository";
import { tipoStatusRepository } from "@/repositories/tipo-status.repository";
import { logService } from "@/services/log.service";
import { PermissaoNegadaError } from "@/services/membro.service";
import { calcularDiff } from "@/lib/utils/diff";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { PrismaClient, Status } from "@prisma/client";

export { PermissaoNegadaError };

export class StatusNaoEncontradoError extends Error {
  constructor() {
    super("Status não encontrado.");
    this.name = "StatusNaoEncontradoError";
  }
}

export class NomeStatusDuplicadoError extends Error {
  constructor() {
    super("Já existe um status com este nome neste escritório.");
    this.name = "NomeStatusDuplicadoError";
  }
}

export class TipoStatusInvalidoError extends Error {
  constructor() {
    super("Tipo de status inválido.");
    this.name = "TipoStatusInvalidoError";
  }
}

export class StatusComCasosError extends Error {
  constructor() {
    super("Este status tem processos vinculados e não pode ser excluído.");
    this.name = "StatusComCasosError";
  }
}

export interface DadosNovoStatus {
  nome: string;
  tipoStatusId: string;
  icone: string;
  cor: string;
  descricao?: string | null;
}

export type DadosEdicaoStatus = Partial<DadosNovoStatus>;

const CAMPOS_AUDITADOS = ["nome", "tipoStatusId", "icone", "cor", "descricao"] as const;

// Os 6 status padrão criados para todo novo escritório (RN — plano.md), um por
// TipoStatus, na ordem em que aparecem no kanban recém-criado.
const STATUS_PADROES: DadosNovoStatus[] = [
  { nome: "Nova conversa", icone: "MessageCircle", cor: "#64748b", tipoStatusId: "nova_conversa" },
  { nome: "Em análise", icone: "Search", cor: "#f59e0b", tipoStatusId: "analise" },
  { nome: "Qualificado", icone: "CircleCheck", cor: "#0ea5e9", tipoStatusId: "qualificado" },
  { nome: "Proposta enviada", icone: "FileText", cor: "#8b5cf6", tipoStatusId: "proposta" },
  { nome: "Contrato fechado", icone: "Trophy", cor: "#10b981", tipoStatusId: "sucesso" },
  { nome: "Não interessado", icone: "CircleX", cor: "#f43f5e", tipoStatusId: "perda" },
];

type Db = Pick<PrismaClient, "status" | "caso" | "tipoStatus">;

// Escrita de Status é ação de configuração do funil: só owner/admin (padrao só lê),
// mesma convenção usada em escritorioService.atualizarEscritorio.
function exigirPapelDeGestao(ctx: TenantContext): void {
  if (ctx.role === "padrao") {
    throw new PermissaoNegadaError();
  }
}

export const statusService = {
  async listar(ctx: TenantContext): Promise<Status[]> {
    return statusRepository.listar(ctx.escritorioId);
  },

  async obter(ctx: TenantContext, id: string): Promise<Status> {
    const status = await statusRepository.findById(id);
    // Status de outro escritório é tratado como inexistente — não confirma a existência.
    if (!status || status.escritorioId !== ctx.escritorioId) {
      throw new StatusNaoEncontradoError();
    }
    return status;
  },

  async criar(ctx: TenantContext, dados: DadosNovoStatus): Promise<Status> {
    exigirPapelDeGestao(ctx);

    const tipo = await tipoStatusRepository.findById(dados.tipoStatusId);
    if (!tipo) {
      throw new TipoStatusInvalidoError();
    }

    const nome = dados.nome.trim();
    const existente = await statusRepository.findByNome(ctx.escritorioId, nome);
    if (existente) {
      throw new NomeStatusDuplicadoError();
    }

    const atuais = await statusRepository.listar(ctx.escritorioId);
    const ordem = atuais.reduce((max, s) => Math.max(max, s.ordem), 0) + 1;

    return prisma.$transaction(async (tx) => {
      const status = await statusRepository.create(
        {
          nome,
          icone: dados.icone,
          cor: dados.cor,
          descricao: dados.descricao?.trim() || null,
          ordem,
          escritorio: { connect: { id: ctx.escritorioId } },
          tipo: { connect: { id: tipo.id } },
        },
        tx
      );

      await logService.registrar(
        ctx,
        {
          acao: "criar",
          entidade: "status",
          entidadeId: status.id,
          resumo: `Status ${status.nome} criado`,
        },
        tx
      );

      return status;
    });
  },

  async atualizar(ctx: TenantContext, id: string, dados: DadosEdicaoStatus): Promise<Status> {
    exigirPapelDeGestao(ctx);

    const atual = await this.obter(ctx, id);

    if (dados.tipoStatusId !== undefined) {
      const tipo = await tipoStatusRepository.findById(dados.tipoStatusId);
      if (!tipo) {
        throw new TipoStatusInvalidoError();
      }
    }

    const mudancas: DadosEdicaoStatus = {
      ...(dados.nome !== undefined ? { nome: dados.nome.trim() } : {}),
      ...(dados.tipoStatusId !== undefined ? { tipoStatusId: dados.tipoStatusId } : {}),
      ...(dados.icone !== undefined ? { icone: dados.icone } : {}),
      ...(dados.cor !== undefined ? { cor: dados.cor } : {}),
      ...(dados.descricao !== undefined ? { descricao: dados.descricao?.trim() || null } : {}),
    };

    if (mudancas.nome !== undefined && mudancas.nome !== atual.nome) {
      const existente = await statusRepository.findByNome(ctx.escritorioId, mudancas.nome);
      if (existente) {
        throw new NomeStatusDuplicadoError();
      }
    }

    const diff = calcularDiff(atual, mudancas, CAMPOS_AUDITADOS);
    // Nada mudou de fato: não toca no banco nem polui a auditoria com log vazio.
    if (!diff) {
      return atual;
    }

    return prisma.$transaction(async (tx) => {
      const status = await statusRepository.update(id, mudancas, tx);
      await logService.registrar(
        ctx,
        {
          acao: "atualizar",
          entidade: "status",
          entidadeId: status.id,
          resumo: `Status ${status.nome} atualizado`,
          dados: diff,
        },
        tx
      );
      return status;
    });
  },

  async excluir(ctx: TenantContext, id: string): Promise<void> {
    exigirPapelDeGestao(ctx);

    const atual = await this.obter(ctx, id);

    // Checado antes de excluir para devolver um erro de domínio amigável em vez de
    // deixar estourar a violação de FK (onDelete: Restrict) do Caso.status.
    const totalCasos = await statusRepository.contarCasos(id);
    if (totalCasos > 0) {
      throw new StatusComCasosError();
    }

    await prisma.$transaction(async (tx) => {
      await statusRepository.delete(id, tx);
      await logService.registrar(
        ctx,
        {
          acao: "excluir",
          entidade: "status",
          entidadeId: atual.id,
          resumo: `Status ${atual.nome} excluído`,
        },
        tx
      );
    });
  },

  // Chamado dentro da mesma transação de escritorioService.criarEscritorio para
  // seedar os 6 status padrão (um por TipoStatus) de um escritório recém-criado.
  async criarPadroes(escritorioId: string, db: Db = prisma): Promise<Status[]> {
    const status: Status[] = [];
    for (const [indice, padrao] of STATUS_PADROES.entries()) {
      const tipo = await tipoStatusRepository.findByChave(padrao.tipoStatusId, db);
      if (!tipo) {
        throw new TipoStatusInvalidoError();
      }
      status.push(
        await statusRepository.create(
          {
            nome: padrao.nome,
            icone: padrao.icone,
            cor: padrao.cor,
            ordem: indice + 1,
            escritorio: { connect: { id: escritorioId } },
            tipo: { connect: { id: tipo.id } },
          },
          db
        )
      );
    }
    return status;
  },
};
