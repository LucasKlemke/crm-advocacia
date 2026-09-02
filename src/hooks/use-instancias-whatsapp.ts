"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type {
  ListaInstanciasWhatsapp,
  RespostaConexaoInstanciaWhatsapp,
  RespostaStatusInstanciaWhatsapp,
} from "@/types/instancia-whatsapp";

export interface DadosNovaInstanciaWhatsapp {
  nome: string;
}

// Key padronizada [entidade] para que qualquer mutation invalide a listagem inteira com
// um único invalidateQueries — a lista de instâncias é pequena (por escritório), não há
// filtro/paginação aqui.
export const chaveInstanciasWhatsapp = () => ["instancias-whatsapp"] as const;

export function useInstanciasWhatsapp() {
  return useQuery({
    queryKey: chaveInstanciasWhatsapp(),
    queryFn: () => apiFetch<ListaInstanciasWhatsapp>("/api/instancias"),
  });
}

export function useCriarInstanciaWhatsapp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dados: DadosNovaInstanciaWhatsapp) =>
      apiFetch<RespostaConexaoInstanciaWhatsapp>("/api/instancias", {
        method: "POST",
        body: JSON.stringify(dados),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaveInstanciasWhatsapp() }),
  });
}

export function useReconectarInstanciaWhatsapp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<RespostaConexaoInstanciaWhatsapp>(`/api/instancias/${id}/reconectar`, {
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaveInstanciasWhatsapp() }),
  });
}

// Disparado manualmente pelo botão "Verificar conexão" — sem polling automático (fora do
// escopo desta entrega), por isso é uma mutation e não uma query.
export function useVerificarStatusInstanciaWhatsapp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<RespostaStatusInstanciaWhatsapp>(`/api/instancias/${id}/status`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaveInstanciasWhatsapp() }),
  });
}

// Disparado pelo botão "Sincronizar" — atualiza TODAS as instâncias do escritório numa
// única chamada em lote (/instance/all na UAZAPI), em vez de uma requisição por instância.
export function useSincronizarInstanciasWhatsapp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<ListaInstanciasWhatsapp>("/api/instancias/sincronizar", {
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaveInstanciasWhatsapp() }),
  });
}

// Encerra a sessão do WhatsApp mantendo a instância cadastrada — depois dela, a linha
// volta pro estado "desconectada" e o botão Reconectar reaparece na listagem.
export function useDesconectarInstanciaWhatsapp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<RespostaStatusInstanciaWhatsapp>(`/api/instancias/${id}/desconectar`, {
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaveInstanciasWhatsapp() }),
  });
}

// Apaga a instância aqui e na UAZAPI. Campanhas antigas continuam existindo (a FK é
// SetNull), apenas sem instância vinculada.
export function useExcluirInstanciaWhatsapp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/api/instancias/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaveInstanciasWhatsapp() }),
  });
}
