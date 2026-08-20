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

export interface ContagemPorMes {
  mes: string;
  total: number;
}

export interface ResumoDashboard {
  porTipoStatus: ContagemPorTipoStatus[];
  porMes: ContagemPorMes[];
  valorTotalAberto: number;
}

const MESES_HISTORICO = 6;

function chaveMes(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
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

  async casosPorMes(ctx: TenantContext, filtros: FiltrosDashboard = {}): Promise<ContagemPorMes[]> {
    const agora = new Date();
    const seisMesesAtras = new Date(agora.getFullYear(), agora.getMonth() - (MESES_HISTORICO - 1), 1);

    // O período do header pode encurtar a janela (nunca alargar): os "últimos 6
    // meses" do gráfico sempre ficam fixos, um dataInicio do usuário só restringe
    // ainda mais quais casos daquela janela entram na contagem.
    const dataInicioEfetiva =
      filtros.dataInicio && filtros.dataInicio > seisMesesAtras ? filtros.dataInicio : seisMesesAtras;

    const datas = await casoRepository.listarDatasCriacao(ctx.escritorioId, {
      ...filtros,
      dataInicio: dataInicioEfetiva,
    });

    const totalPorMes = new Map<string, number>();
    for (const data of datas) {
      const chave = chaveMes(data);
      totalPorMes.set(chave, (totalPorMes.get(chave) ?? 0) + 1);
    }

    // Zero-fill: um mês sem casos ainda aparece na série, com total 0.
    const meses: ContagemPorMes[] = [];
    for (let i = MESES_HISTORICO - 1; i >= 0; i--) {
      const data = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const mes = chaveMes(data);
      meses.push({ mes, total: totalPorMes.get(mes) ?? 0 });
    }

    return meses;
  },

  async valorTotalAberto(ctx: TenantContext, filtros: FiltrosDashboard = {}): Promise<number> {
    return casoRepository.somarValorAberto(ctx.escritorioId, filtros);
  },

  async resumo(ctx: TenantContext, filtros: FiltrosDashboard = {}): Promise<ResumoDashboard> {
    const [porTipoStatus, porMes, valorTotalAberto] = await Promise.all([
      this.contarPorTipoStatus(ctx, filtros),
      this.casosPorMes(ctx, filtros),
      this.valorTotalAberto(ctx, filtros),
    ]);
    return { porTipoStatus, porMes, valorTotalAberto };
  },
};
