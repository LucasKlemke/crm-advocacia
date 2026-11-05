import { useQuery } from "@tanstack/react-query";
import type { RoleMembro } from "@prisma/client";
import { apiFetch } from "@/lib/api-client";

export interface EscritorioDoUsuarioDTO {
  id: string;
  nome: string;
  role: RoleMembro;
}

export interface EscritorioAtualDTO {
  id: string;
  nome: string;
  oabResponsavel: string | null;
  telefoneWhatsapp: string | null;
}

// Raiz comum: renomear o escritório (EscritorioForm → refresh) refaz a lista do switcher
// e os dados da tela de configurações de uma vez.
export const RAIZ_ESCRITORIOS = ["escritorios"] as const;
export const chaveMeusEscritorios = () => [...RAIZ_ESCRITORIOS, "meus"] as const;
export const chaveEscritorioAtual = () => [...RAIZ_ESCRITORIOS, "atual"] as const;

export function useMeusEscritorios() {
  return useQuery({
    queryKey: chaveMeusEscritorios(),
    queryFn: async () =>
      (await apiFetch<{ escritorios: EscritorioDoUsuarioDTO[] }>("/api/escritorios")).escritorios,
  });
}

export function useEscritorioAtual() {
  return useQuery({
    queryKey: chaveEscritorioAtual(),
    queryFn: async () =>
      (await apiFetch<{ escritorio: EscritorioAtualDTO }>("/api/escritorios/atual")).escritorio,
  });
}
