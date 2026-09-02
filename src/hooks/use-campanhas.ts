"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { ConfigVariavel } from "@/lib/utils/campanha-mensagem";
import type {
  AcaoCampanha,
  ListaCampanhas,
  RespostaCampanha,
  RespostaControleCampanha,
  RespostaItensCampanha,
  RespostaMensagensCampanha,
} from "@/types/campanha";

export interface DadosNovaCampanha {
  nome: string;
  instanciaId: string;
  mensagemTemplate: string;
  colunaNumero: string;
  mapeamentoVariaveis: Record<string, ConfigVariavel>;
  delayMin: number;
  delayMax: number;
  agendadaPara?: string;
  arquivoCsvNome?: string;
  linhas: Record<string, string>[];
}

// Toda key nasce sob a raiz ["campanhas"]: um único invalidateQueries alcança a listagem
// e a tela de detalhe, que nunca ficam dessincronizadas depois de uma escrita.
export const RAIZ_CAMPANHAS = ["campanhas"] as const;
export const chaveCampanhas = () => RAIZ_CAMPANHAS;
export const chaveCampanha = (id: string, pagina: number) =>
  [...RAIZ_CAMPANHAS, "detalhe", id, pagina] as const;
export const chaveMensagensCampanha = (id: string) =>
  [...RAIZ_CAMPANHAS, "mensagens", id] as const;

export function useCampanhas() {
  return useQuery({
    queryKey: chaveCampanhas(),
    queryFn: () => apiFetch<ListaCampanhas>("/api/campanhas"),
  });
}

export function useCampanha(id: string, pagina: number) {
  return useQuery({
    queryKey: chaveCampanha(id, pagina),
    queryFn: () =>
      apiFetch<RespostaCampanha & RespostaItensCampanha>(`/api/campanhas/${id}?pagina=${pagina}`),
  });
}

// Status de cada mensagem, direto da UAZAPI. Query separada da do detalhe de propósito: a
// tabela do banco aparece na hora e o status chega depois, sem prender a tela na chamada
// externa. `habilitado` é o que garante a ordem — só consulta depois que o banco respondeu.
export function useMensagensCampanha(id: string, habilitado = true) {
  return useQuery({
    queryKey: chaveMensagensCampanha(id),
    queryFn: () => apiFetch<RespostaMensagensCampanha>(`/api/campanhas/${id}/mensagens`),
    enabled: habilitado,
    // UAZAPI fora do ar não vale três tentativas com backoff: a tabela mostra "—" e segue.
    retry: 1,
  });
}

export function useCriarCampanha() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dados: DadosNovaCampanha) =>
      apiFetch<RespostaCampanha>("/api/campanhas", {
        method: "POST",
        body: JSON.stringify(dados),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RAIZ_CAMPANHAS }),
  });
}

export function useSincronizarCampanha() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<RespostaCampanha>(`/api/campanhas/${id}/sincronizar`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RAIZ_CAMPANHAS }),
  });
}

export function useControlarCampanha() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, acao }: { id: string; acao: AcaoCampanha }) =>
      apiFetch<RespostaControleCampanha>(`/api/campanhas/${id}/controlar`, {
        method: "POST",
        body: JSON.stringify({ acao }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RAIZ_CAMPANHAS }),
  });
}
