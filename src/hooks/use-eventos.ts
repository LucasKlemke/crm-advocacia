"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { RAIZ_EVENTOS, chaveEventos } from "@/lib/query/chaves";
import type { EventoDTO, FiltrosEventos, ListaEventos, ModalidadeEvento } from "@/types/evento";

// Espelha o corpo aceito por POST /api/eventos (novoEventoSchema). Datas em ISO/UTC —
// a conversão do <input datetime-local> é feita pelo formulário, não aqui.
export interface DadosEventoPayload {
  titulo: string;
  descricao?: string | null;
  inicio: string;
  fim: string;
  diaInteiro: boolean;
  modalidade: ModalidadeEvento;
  local?: string | null;
  linkReuniao?: string | null;
  casoId?: string | null;
  clienteId?: string | null;
  participanteMembroIds: string[];
}

export function useEventos(filtros: FiltrosEventos) {
  return useQuery({
    queryKey: chaveEventos(filtros),
    queryFn: () =>
      apiFetch<ListaEventos>(
        `/api/eventos?inicio=${encodeURIComponent(filtros.inicio)}&fim=${encodeURIComponent(filtros.fim)}`
      ),
    // Navegar entre meses volta e vem no mesmo período o tempo todo: manter o dado
    // anterior visível evita o calendário piscar para vazio a cada clique em ◀/▶.
    placeholderData: (anterior) => anterior,
  });
}

// Invalida a raiz, não a key do período: a mesma escrita precisa alcançar a visão de
// mês, de semana e de dia, que consultam períodos diferentes do mesmo recurso.
function useInvalidarEventos() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: RAIZ_EVENTOS });
}

export function useCriarEvento() {
  const invalidar = useInvalidarEventos();
  return useMutation({
    mutationFn: (dados: DadosEventoPayload) =>
      apiFetch<{ evento: EventoDTO }>("/api/eventos", {
        method: "POST",
        body: JSON.stringify(dados),
      }),
    onSuccess: invalidar,
  });
}

export function useAtualizarEvento() {
  const invalidar = useInvalidarEventos();
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: Partial<DadosEventoPayload> }) =>
      apiFetch<{ evento: EventoDTO }>(`/api/eventos/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dados),
      }),
    onSuccess: invalidar,
  });
}

export function useExcluirEvento() {
  const invalidar = useInvalidarEventos();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: true }>(`/api/eventos/${id}`, { method: "DELETE" }),
    onSuccess: invalidar,
  });
}
