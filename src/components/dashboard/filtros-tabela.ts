import { filtrosCasosPadrao } from "@/types/caso";
import type { FiltrosCasos } from "@/types/caso";
import type { FiltrosDashboard } from "@/types/dashboard";

// Traduz o estado do header do dashboard (+ os cards de status selecionados) para os
// filtros da tabela de preview. Função pura e compartilhada porque as duas pontas
// precisam produzir o mesmo objeto: o cliente para montar a query key em
// dashboard-view.tsx, e o servidor para prefetchar exatamente essa mesma key.
export function filtrosTabelaDashboard(
  filtros: FiltrosDashboard,
  selecionadosIds: string[]
): FiltrosCasos {
  return {
    ...filtrosCasosPadrao,
    tipoStatusIds: selecionadosIds,
    clienteIds: filtros.clienteIds,
    responsavelIds: filtros.responsavelIds,
    dataInicio: filtros.dataInicio,
    dataFim: filtros.dataFim,
  };
}
