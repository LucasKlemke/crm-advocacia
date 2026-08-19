"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { ComentarioDTO, EscopoComentarioDTO } from "@/types/cliente";

export const chaveComentarios = (escopo: EscopoComentarioDTO, escopoId: string) =>
  ["comentarios", escopo, escopoId] as const;

export function useComentarios(escopo: EscopoComentarioDTO, escopoId: string | null) {
  return useQuery({
    queryKey: chaveComentarios(escopo, escopoId ?? ""),
    queryFn: () =>
      apiFetch<{ comentarios: ComentarioDTO[] }>(
        `/api/comentarios?escopo=${escopo}&escopoId=${escopoId}`
      ),
    // Sem alvo selecionado não há o que buscar (drawer fechado).
    enabled: Boolean(escopoId),
  });
}

// As três mutations compartilham a mesma invalidação: a timeline do escopo aberto.
function useInvalidarComentarios(escopo: EscopoComentarioDTO, escopoId: string | null) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: chaveComentarios(escopo, escopoId ?? "") });
}

export function useCriarComentario(escopo: EscopoComentarioDTO, escopoId: string | null) {
  const invalidar = useInvalidarComentarios(escopo, escopoId);
  return useMutation({
    mutationFn: (conteudo: string) =>
      apiFetch<{ comentario: ComentarioDTO }>("/api/comentarios", {
        method: "POST",
        body: JSON.stringify({ escopo, escopoId, conteudo }),
      }),
    onSuccess: invalidar,
  });
}

export function useAtualizarComentario(escopo: EscopoComentarioDTO, escopoId: string | null) {
  const invalidar = useInvalidarComentarios(escopo, escopoId);
  return useMutation({
    mutationFn: ({ id, conteudo }: { id: string; conteudo: string }) =>
      apiFetch<{ comentario: ComentarioDTO }>(`/api/comentarios/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ conteudo }),
      }),
    onSuccess: invalidar,
  });
}

export function useExcluirComentario(escopo: EscopoComentarioDTO, escopoId: string | null) {
  const invalidar = useInvalidarComentarios(escopo, escopoId);
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: true }>(`/api/comentarios/${id}`, { method: "DELETE" }),
    onSuccess: invalidar,
  });
}
