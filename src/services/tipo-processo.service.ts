import { prisma } from "@/lib/prisma";
import { tipoProcessoRepository } from "@/repositories/tipo-processo.repository";
import { logService } from "@/services/log.service";
import { PermissaoNegadaError } from "@/services/membro.service";
import { calcularDiff } from "@/lib/utils/diff";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { PrismaClient, TipoProcesso } from "@prisma/client";

export { PermissaoNegadaError };

export class TipoProcessoNaoEncontradoError extends Error {
  constructor() {
    super("Tipo de processo não encontrado.");
    this.name = "TipoProcessoNaoEncontradoError";
  }
}

export class NomeTipoProcessoDuplicadoError extends Error {
  constructor() {
    super("Já existe um tipo de processo com este nome neste escritório.");
    this.name = "NomeTipoProcessoDuplicadoError";
  }
}

export class TipoProcessoComCasosError extends Error {
  constructor() {
    super("Este tipo tem processos vinculados e não pode ser excluído.");
    this.name = "TipoProcessoComCasosError";
  }
}

export interface DadosNovoTipoProcesso {
  nome: string;
  icone: string;
  cor: string;
  descricao?: string | null;
}

export type DadosEdicaoTipoProcesso = Partial<DadosNovoTipoProcesso>;

const CAMPOS_AUDITADOS = ["nome", "icone", "cor", "descricao"] as const;

// Conjunto inicial criado para todo escritório novo: naturezas de processo comuns na
// advocacia, para o primeiro caso poder ser cadastrado sem passar antes por
// /configuracoes/tipos-processo (o tipo é obrigatório). O escritório renomeia, exclui
// ou acrescenta o que quiser depois. Espelha STATUS_PADROES em status.service.ts.
const TIPOS_PROCESSO_PADROES: DadosNovoTipoProcesso[] = [
  {
    nome: "Ação trabalhista",
    icone: "Scale",
    cor: "#6366f1",
    descricao: "Reclamatória trabalhista e demais demandas da Justiça do Trabalho.",
  },
  {
    nome: "Ação de cobrança",
    icone: "Gavel",
    cor: "#f59e0b",
    descricao: "Cobrança judicial de dívida ou título não pago.",
  },
  {
    nome: "Divórcio",
    icone: "Users",
    cor: "#f43f5e",
    descricao: "Dissolução de casamento ou união estável, consensual ou litigiosa.",
  },
  {
    nome: "Inventário",
    icone: "FileText",
    cor: "#8b5cf6",
    descricao: "Partilha de bens após o falecimento do titular.",
  },
  {
    nome: "Aposentadoria",
    icone: "BadgeCheck",
    cor: "#10b981",
    descricao: "Pedido ou revisão de benefício previdenciário junto ao INSS.",
  },
  {
    nome: "Revisional",
    icone: "TrendingDown",
    cor: "#0ea5e9",
    descricao: "Revisão de contrato ou de juros considerados abusivos.",
  },
  {
    nome: "Indenizatória",
    icone: "AlertCircle",
    cor: "#ef4444",
    descricao: "Reparação por dano material ou moral.",
  },
  {
    nome: "Consultivo",
    icone: "Briefcase",
    cor: "#64748b",
    descricao: "Orientação jurídica e elaboração de contratos, sem litígio.",
  },
];

type Db = Pick<PrismaClient, "tipoProcesso" | "caso">;

// Escrita de TipoProcesso é ação de configuração do escritório: só owner/admin (padrao
// só lê), mesma convenção de statusService.
function exigirPapelDeGestao(ctx: TenantContext): void {
  if (ctx.role === "padrao") {
    throw new PermissaoNegadaError();
  }
}

export const tipoProcessoService = {
  async listar(ctx: TenantContext): Promise<TipoProcesso[]> {
    return tipoProcessoRepository.listar(ctx.escritorioId);
  },

  async obter(ctx: TenantContext, id: string): Promise<TipoProcesso> {
    const tipo = await tipoProcessoRepository.findById(id);
    // Tipo de outro escritório é tratado como inexistente — não confirma a existência.
    if (!tipo || tipo.escritorioId !== ctx.escritorioId) {
      throw new TipoProcessoNaoEncontradoError();
    }
    return tipo;
  },

  async criar(ctx: TenantContext, dados: DadosNovoTipoProcesso): Promise<TipoProcesso> {
    exigirPapelDeGestao(ctx);

    const nome = dados.nome.trim();
    const existente = await tipoProcessoRepository.findByNome(ctx.escritorioId, nome);
    if (existente) {
      throw new NomeTipoProcessoDuplicadoError();
    }

    const atuais = await tipoProcessoRepository.listar(ctx.escritorioId);
    const ordem = atuais.reduce((max, t) => Math.max(max, t.ordem), 0) + 1;

    return prisma.$transaction(async (tx) => {
      const tipo = await tipoProcessoRepository.create(
        {
          nome,
          icone: dados.icone,
          cor: dados.cor,
          descricao: dados.descricao?.trim() || null,
          ordem,
          escritorio: { connect: { id: ctx.escritorioId } },
        },
        tx
      );

      await logService.registrar(
        ctx,
        {
          acao: "criar",
          entidade: "tipo_processo",
          entidadeId: tipo.id,
          resumo: `Tipo de processo ${tipo.nome} criado`,
        },
        tx
      );

      return tipo;
    });
  },

  async atualizar(
    ctx: TenantContext,
    id: string,
    dados: DadosEdicaoTipoProcesso
  ): Promise<TipoProcesso> {
    exigirPapelDeGestao(ctx);

    const atual = await this.obter(ctx, id);

    const mudancas: DadosEdicaoTipoProcesso = {
      ...(dados.nome !== undefined ? { nome: dados.nome.trim() } : {}),
      ...(dados.icone !== undefined ? { icone: dados.icone } : {}),
      ...(dados.cor !== undefined ? { cor: dados.cor } : {}),
      ...(dados.descricao !== undefined ? { descricao: dados.descricao?.trim() || null } : {}),
    };

    if (mudancas.nome !== undefined && mudancas.nome !== atual.nome) {
      const existente = await tipoProcessoRepository.findByNome(ctx.escritorioId, mudancas.nome);
      if (existente) {
        throw new NomeTipoProcessoDuplicadoError();
      }
    }

    const diff = calcularDiff(atual, mudancas, CAMPOS_AUDITADOS);
    // Nada mudou de fato: não toca no banco nem polui a auditoria com log vazio.
    if (!diff) {
      return atual;
    }

    return prisma.$transaction(async (tx) => {
      const tipo = await tipoProcessoRepository.update(id, mudancas, tx);
      await logService.registrar(
        ctx,
        {
          acao: "atualizar",
          entidade: "tipo_processo",
          entidadeId: tipo.id,
          resumo: `Tipo de processo ${tipo.nome} atualizado`,
          dados: diff,
        },
        tx
      );
      return tipo;
    });
  },

  async excluir(ctx: TenantContext, id: string): Promise<void> {
    exigirPapelDeGestao(ctx);

    const atual = await this.obter(ctx, id);

    // Checado antes de excluir para devolver um erro de domínio amigável em vez de
    // deixar estourar a violação de FK (onDelete: Restrict) do Caso.tipoProcesso.
    const totalCasos = await tipoProcessoRepository.contarCasos(id);
    if (totalCasos > 0) {
      throw new TipoProcessoComCasosError();
    }

    await prisma.$transaction(async (tx) => {
      await tipoProcessoRepository.delete(id, tx);
      await logService.registrar(
        ctx,
        {
          acao: "excluir",
          entidade: "tipo_processo",
          entidadeId: atual.id,
          resumo: `Tipo de processo ${atual.nome} excluído`,
        },
        tx
      );
    });
  },

  // Chamado dentro da mesma transação de escritorioService.criarEscritorio para seedar
  // os tipos iniciais de um escritório recém-criado.
  async criarPadroes(escritorioId: string, db: Db = prisma): Promise<TipoProcesso[]> {
    const tipos: TipoProcesso[] = [];
    for (const [indice, padrao] of TIPOS_PROCESSO_PADROES.entries()) {
      tipos.push(
        await tipoProcessoRepository.create(
          {
            nome: padrao.nome,
            icone: padrao.icone,
            cor: padrao.cor,
            descricao: padrao.descricao ?? null,
            ordem: indice + 1,
            escritorio: { connect: { id: escritorioId } },
          },
          db
        )
      );
    }
    return tipos;
  },
};
