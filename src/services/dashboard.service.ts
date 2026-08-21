import { casoRepository } from "@/repositories/caso.repository";
import { statusRepository } from "@/repositories/status.repository";
import { tipoStatusRepository } from "@/repositories/tipo-status.repository";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { TipoStatus } from "@prisma/client";

// Filtros que o header do dashboard aplica a todos os dados exibidos (cards, gráficos
// e tabela) — mesmo subconjunto de FiltrosCaso usado pelos filtros de /casos, sem
// busca/status/tipoStatus/arquivado (esses não fazem sentido fora da tabela de casos).
export interface FiltrosDashboard {
  clienteIds?: string[];
  responsavelIds?: string[];
  dataInicio?: Date;
  dataFim?: Date;
}

export interface ContagemPorTipoStatus {
  tipoStatus: TipoStatus;
  total: number;
  valorTotal: number;
}

export interface ResumoDashboard {
  porTipoStatus: ContagemPorTipoStatus[];
}

export const dashboardService = {
  async contarPorTipoStatus(
    ctx: TenantContext,
    filtros: FiltrosDashboard = {}
  ): Promise<ContagemPorTipoStatus[]> {
    const [tiposStatus, todosStatus, contagensPorStatus] = await Promise.all([
      tipoStatusRepository.listar(),
      statusRepository.listar(ctx.escritorioId),
      casoRepository.contarPorStatus(ctx.escritorioId, filtros),
    ]);

    // Cards são por TipoStatus (categoria global): soma-se a contagem e o valor de
    // todos os Status do tenant mapeados para a mesma categoria.
    const totalPorTipoStatusId = new Map<string, { total: number; valorTotal: number }>();
    for (const status of todosStatus) {
      const contagem = contagensPorStatus.find((c) => c.statusId === status.id);
      const acumulado = totalPorTipoStatusId.get(status.tipoStatusId) ?? {
        total: 0,
        valorTotal: 0,
      };
      totalPorTipoStatusId.set(status.tipoStatusId, {
        total: acumulado.total + (contagem?.total ?? 0),
        valorTotal: acumulado.valorTotal + (contagem?.valorTotal ?? 0),
      });
    }

    // Sempre as 6 categorias, mesmo com contagem 0 — nunca omitir.
    return tiposStatus.map((tipoStatus) => {
      const acumulado = totalPorTipoStatusId.get(tipoStatus.id);
      return {
        tipoStatus,
        total: acumulado?.total ?? 0,
        valorTotal: acumulado?.valorTotal ?? 0,
      };
    });
  },

  async resumo(ctx: TenantContext, filtros: FiltrosDashboard = {}): Promise<ResumoDashboard> {
    const porTipoStatus = await this.contarPorTipoStatus(ctx, filtros);
    return { porTipoStatus };
  },
};
