"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { filtrosDashboardPadrao } from "@/types/dashboard";
import type { FiltrosDashboard, ResumoDashboardDTO } from "@/types/dashboard";

const RAIZ = ["dashboard"] as const;

export const chaveDashboardResumo = (filtros: FiltrosDashboard = filtrosDashboardPadrao) =>
  [...RAIZ, "resumo", filtros] as const;

function urlResumo(filtros: FiltrosDashboard): string {
  const params = new URLSearchParams();
  if (filtros.clienteIds.length > 0) params.set("clienteId", filtros.clienteIds.join(","));
  if (filtros.responsavelIds.length > 0) {
    params.set("responsavelId", filtros.responsavelIds.join(","));
  }
  if (filtros.dataInicio) params.set("dataInicio", filtros.dataInicio);
  if (filtros.dataFim) params.set("dataFim", filtros.dataFim);
  const query = params.toString();
  return query ? `/api/dashboard/resumo?${query}` : "/api/dashboard/resumo";
}

export function useDashboardResumo(filtros: FiltrosDashboard = filtrosDashboardPadrao) {
  return useQuery({
    queryKey: chaveDashboardResumo(filtros),
    queryFn: () => apiFetch<ResumoDashboardDTO>(urlResumo(filtros)),
    placeholderData: (anterior) => anterior,
  });
}
