// DTO trafegado por GET /api/dashboard/resumo. `dashboardService.resumo` devolve o
// modelo Prisma `TipoStatus` puro (id/chave/nome/icone/cor/descricao/ordem) — o mesmo
// formato já usado por TipoStatusDTO (src/types/status.ts), daqui reaproveitado em vez
// de duplicado.
import type { TipoStatusDTO } from "@/types/status";

export interface ContagemPorTipoStatusDTO {
  tipoStatus: TipoStatusDTO;
  total: number;
  valorTotal: number;
}

export interface ContagemPorMesDTO {
  mes: string;
  total: number;
}

export interface ResumoDashboardDTO {
  porTipoStatus: ContagemPorTipoStatusDTO[];
  porMes: ContagemPorMesDTO[];
  valorTotalAberto: number;
}

// Filtro do header do dashboard (dashboard-view.tsx): mesmo subconjunto de
// FiltrosCasos (cliente/responsável/período) usado pelo header de /casos, aplicado a
// todo o resumo — cards, gráficos e tabela — não só à tabela.
export interface FiltrosDashboard {
  clienteIds: string[];
  responsavelIds: string[];
  dataInicio: string | null;
  dataFim: string | null;
}

export const filtrosDashboardPadrao: FiltrosDashboard = {
  clienteIds: [],
  responsavelIds: [],
  dataInicio: null,
  dataFim: null,
};
