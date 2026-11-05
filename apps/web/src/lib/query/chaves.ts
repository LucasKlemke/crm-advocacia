import { filtrosDashboardPadrao } from "@crm/compartilhado/tipos/dashboard";
import type { FiltrosCasos } from "@crm/compartilhado/tipos/caso";
import type { FiltrosDashboard } from "@crm/compartilhado/tipos/dashboard";
import type { FiltrosEventos } from "@crm/compartilhado/tipos/evento";

// Fábricas de query key compartilhadas entre hooks; uma escrita invalida pela raiz.

// Toda key de casos nasce sob a raiz ["casos"]: um único invalidateQueries({queryKey:
// ["casos"]}) alcança listagem, kanban e qualquer página filtrada — kanban e tabela
// nunca ficam dessincronizados depois de uma escrita.
export const RAIZ_CASOS = ["casos"] as const;

export const chaveCasos = (filtros?: FiltrosCasos) =>
  filtros ? ([...RAIZ_CASOS, "list", filtros] as const) : RAIZ_CASOS;

export const chaveCasosKanban = (filtros?: Omit<FiltrosCasos, "pagina">) =>
  filtros ? ([...RAIZ_CASOS, "kanban", filtros] as const) : ([...RAIZ_CASOS, "kanban"] as const);

export const chaveCasosColuna = (
  statusId: string,
  filtros: Omit<FiltrosCasos, "pagina" | "statusIds">,
  pagina: number
) => [...RAIZ_CASOS, "coluna", statusId, filtros, pagina] as const;

export const chaveCasosFiltroOpcoes = () => [...RAIZ_CASOS, "filtros"] as const;

export const RAIZ_DASHBOARD = ["dashboard"] as const;

export const chaveDashboardResumo = (filtros: FiltrosDashboard = filtrosDashboardPadrao) =>
  [...RAIZ_DASHBOARD, "resumo", filtros] as const;

// Toda key da agenda nasce sob a raiz ["eventos"]: uma escrita invalida a visão de mês,
// de semana e de dia de uma vez, porque as três consultam o mesmo recurso com períodos
// diferentes — sem a raiz comum, criar um evento na visão de dia deixaria a de mês stale.
export const RAIZ_EVENTOS = ["eventos"] as const;

export const chaveEventos = (filtros?: FiltrosEventos) =>
  filtros ? ([...RAIZ_EVENTOS, "periodo", filtros.inicio, filtros.fim] as const) : RAIZ_EVENTOS;

// Sessão do usuário logado (GET /api/auth/sessao). Vive no queryClientRaiz, fora do
// cache do tenant — ver lib/query/query-client-raiz.ts.
export const chaveSessao = () => ["sessao"] as const;
