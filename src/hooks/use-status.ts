"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { ListaStatus, ListaTiposStatus, StatusDTO } from "@/types/status";

export interface DadosStatusForm {
  nome: string;
  tipoStatusId: string;
  icone: string;
  cor: string;
  descricao?: string | null;
}

// Key padronizada [entidade] para que qualquer mutation invalide a listagem
// inteira com um único invalidateQueries — lista de Status é pequena (por
// escritório), não há filtro/paginação aqui.
export const chaveStatus = () => ["status"] as const;
export const chaveTiposStatus = () => ["tipos-status"] as const;

export function useStatus() {
  return useQuery({
    queryKey: chaveStatus(),
    queryFn: () => apiFetch<ListaStatus>("/api/status"),
  });
}

// Tabela global e somente leitura: sem invalidação necessária, pode ficar em
// cache por toda a sessão.
export function useTiposStatus() {
  return useQuery({
    queryKey: chaveTiposStatus(),
    queryFn: () => apiFetch<ListaTiposStatus>("/api/tipos-status"),
    staleTime: Infinity,
  });
}

export function useCriarStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dados: DadosStatusForm) =>
      apiFetch<{ status: StatusDTO }>("/api/status", {
        method: "POST",
        body: JSON.stringify(dados),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaveStatus() }),
  });
}

export function useAtualizarStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: Partial<DadosStatusForm> }) =>
      apiFetch<{ status: StatusDTO }>(`/api/status/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dados),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaveStatus() }),
  });
}

export function useExcluirStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: true }>(`/api/status/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaveStatus() }),
  });
}
