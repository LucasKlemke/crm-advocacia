"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { chaveCasosFiltroOpcoes } from "@/lib/query/chaves";
import type { ListaTiposProcesso, TipoProcessoDTO } from "@/types/tipo-processo";

export interface DadosTipoProcessoForm {
  nome: string;
  icone: string;
  cor: string;
  descricao?: string | null;
}

// Key padronizada [entidade] para que qualquer mutation invalide a listagem inteira
// com um único invalidateQueries — a lista de tipos é pequena (por escritório), não há
// filtro/paginação aqui.
export const chaveTiposProcesso = () => ["tipos-processo"] as const;

export function useTiposProcesso() {
  return useQuery({
    queryKey: chaveTiposProcesso(),
    queryFn: () => apiFetch<ListaTiposProcesso>("/api/tipos-processo"),
  });
}

// Toda mutation invalida também as opções de filtro de casos: o mesmo tipo alimenta o
// select do formulário de processo e o filtro do header, que precisam enxergar na hora
// o tipo recém-criado pelo atalho "criar tipo".
function useInvalidarTiposProcesso() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: chaveTiposProcesso() });
    queryClient.invalidateQueries({ queryKey: chaveCasosFiltroOpcoes() });
  };
}

export function useCriarTipoProcesso() {
  const invalidar = useInvalidarTiposProcesso();
  return useMutation({
    mutationFn: (dados: DadosTipoProcessoForm) =>
      apiFetch<{ tipo: TipoProcessoDTO }>("/api/tipos-processo", {
        method: "POST",
        body: JSON.stringify(dados),
      }),
    onSuccess: invalidar,
  });
}

export function useAtualizarTipoProcesso() {
  const invalidar = useInvalidarTiposProcesso();
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: Partial<DadosTipoProcessoForm> }) =>
      apiFetch<{ tipo: TipoProcessoDTO }>(`/api/tipos-processo/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dados),
      }),
    onSuccess: invalidar,
  });
}

export function useExcluirTipoProcesso() {
  const invalidar = useInvalidarTiposProcesso();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/api/tipos-processo/${id}`, { method: "DELETE" }),
    onSuccess: invalidar,
  });
}
