"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { ClienteDTO, FiltrosClientes, ListaClientes } from "@/types/cliente";

export interface DadosClienteForm {
  nome: string;
  cpf: string;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
}

// Key padronizada [entidade, ...filtros] para que qualquer mutation invalide a
// listagem inteira com um único invalidateQueries(["clientes"]).
export const chaveClientes = (filtros?: FiltrosClientes) =>
  filtros ? (["clientes", filtros] as const) : (["clientes"] as const);

function urlListagem({ busca, incluirExcluidos, pagina }: FiltrosClientes): string {
  const params = new URLSearchParams();
  if (busca.trim()) params.set("busca", busca.trim());
  if (incluirExcluidos) params.set("incluirExcluidos", "true");
  if (pagina > 1) params.set("pagina", String(pagina));
  const query = params.toString();
  return query ? `/api/clientes?${query}` : "/api/clientes";
}

export function useClientes(filtros: FiltrosClientes) {
  return useQuery({
    queryKey: chaveClientes(filtros),
    queryFn: () => apiFetch<ListaClientes>(urlListagem(filtros)),
    placeholderData: (anterior) => anterior,
  });
}

export function useCriarCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dados: DadosClienteForm) =>
      apiFetch<{ cliente: ClienteDTO }>("/api/clientes", {
        method: "POST",
        body: JSON.stringify(dados),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaveClientes() }),
  });
}

export function useAtualizarCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: Partial<DadosClienteForm> }) =>
      apiFetch<{ cliente: ClienteDTO }>(`/api/clientes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dados),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaveClientes() }),
  });
}

export interface ResultadoLote {
  desativados?: number;
  restaurados?: number;
  ignorados: number;
}

export function useAcaoEmLoteClientes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, acao }: { ids: string[]; acao: "desativar" | "restaurar" }) =>
      apiFetch<ResultadoLote>("/api/clientes/lote", {
        method: "POST",
        body: JSON.stringify({ ids, acao }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaveClientes() }),
  });
}
