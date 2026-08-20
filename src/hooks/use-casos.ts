"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type {
  CasoDTO,
  FiltrosCasoOpcoes,
  FiltrosCasos,
  KanbanCasos,
  ListaCasos,
} from "@/types/caso";

export interface DadosCasoForm {
  titulo: string;
  clienteId: string;
  statusId: string;
  responsavelMembroId?: string | null;
  numeroProcesso?: string | null;
  descricao?: string | null;
  valor?: number | null;
}

// Toda key de casos nasce sob a raiz ["casos"]: um único invalidateQueries({queryKey:
// ["casos"]}) alcança listagem, kanban e qualquer página filtrada — kanban e tabela
// nunca ficam dessincronizados depois de uma escrita.
const RAIZ = ["casos"] as const;

export const chaveCasos = (filtros?: FiltrosCasos) =>
  filtros ? ([...RAIZ, "list", filtros] as const) : RAIZ;

export const chaveCasosKanban = (filtros?: Omit<FiltrosCasos, "pagina">) =>
  filtros ? ([...RAIZ, "kanban", filtros] as const) : ([...RAIZ, "kanban"] as const);

export const chaveCasosFiltroOpcoes = () => [...RAIZ, "filtros"] as const;

function paramsDeFiltros(filtros: Partial<FiltrosCasos>): URLSearchParams {
  const params = new URLSearchParams();
  if (filtros.busca?.trim()) params.set("busca", filtros.busca.trim());
  if (filtros.statusIds && filtros.statusIds.length > 0) {
    params.set("statusId", filtros.statusIds.join(","));
  }
  if (filtros.tipoStatusIds && filtros.tipoStatusIds.length > 0) {
    params.set("tipoStatusId", filtros.tipoStatusIds.join(","));
  }
  if (filtros.clienteIds && filtros.clienteIds.length > 0) {
    params.set("clienteId", filtros.clienteIds.join(","));
  }
  if (filtros.responsavelIds && filtros.responsavelIds.length > 0) {
    params.set("responsavelId", filtros.responsavelIds.join(","));
  }
  if (filtros.dataInicio) params.set("dataInicio", filtros.dataInicio);
  if (filtros.dataFim) params.set("dataFim", filtros.dataFim);
  if (filtros.arquivado) params.set("arquivado", "true");
  return params;
}

function urlListagem(filtros: FiltrosCasos): string {
  const params = paramsDeFiltros(filtros);
  if (filtros.pagina > 1) params.set("pagina", String(filtros.pagina));
  const query = params.toString();
  return query ? `/api/casos?${query}` : "/api/casos";
}

function urlKanban(filtros: Omit<FiltrosCasos, "pagina">): string {
  const query = paramsDeFiltros(filtros).toString();
  return query ? `/api/casos/kanban?${query}` : "/api/casos/kanban";
}

export function useCasos(filtros: FiltrosCasos) {
  return useQuery({
    queryKey: chaveCasos(filtros),
    queryFn: () => apiFetch<ListaCasos>(urlListagem(filtros)),
    placeholderData: (anterior) => anterior,
  });
}

export function useCasosKanban(filtros: Omit<FiltrosCasos, "pagina">) {
  return useQuery({
    queryKey: chaveCasosKanban(filtros),
    queryFn: () => apiFetch<KanbanCasos>(urlKanban(filtros)),
    placeholderData: (anterior) => anterior,
  });
}

// Página seguinte de uma única coluna do kanban — usa a listagem paginada normal,
// filtrada para aquele status (o endpoint /kanban só devolve a primeira página).
export function useCasosDaColuna(
  statusId: string,
  filtros: Omit<FiltrosCasos, "pagina" | "statusIds">,
  pagina: number
) {
  return useQuery({
    queryKey: [...RAIZ, "coluna", statusId, filtros, pagina] as const,
    queryFn: () =>
      apiFetch<ListaCasos>(urlListagem({ ...filtros, statusIds: [statusId], pagina })),
    enabled: pagina > 1,
    placeholderData: (anterior) => anterior,
  });
}

export function useCasoFiltroOpcoes() {
  return useQuery({
    queryKey: chaveCasosFiltroOpcoes(),
    queryFn: () => apiFetch<FiltrosCasoOpcoes>("/api/casos/filtros"),
    staleTime: 60_000,
  });
}

export function useCriarCaso() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dados: DadosCasoForm) =>
      apiFetch<{ caso: CasoDTO }>("/api/casos", {
        method: "POST",
        body: JSON.stringify(dados),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RAIZ }),
  });
}

export function useAtualizarCaso() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: Partial<DadosCasoForm> }) =>
      apiFetch<{ caso: CasoDTO }>(`/api/casos/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dados),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RAIZ }),
  });
}

export function useArquivarCaso() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ caso: CasoDTO }>(`/api/casos/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RAIZ }),
  });
}
