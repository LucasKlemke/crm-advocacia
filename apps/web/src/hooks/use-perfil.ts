import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface PerfilDTO {
  id: string;
  nome: string;
  email: string;
  temAvatar: boolean;
}

export const chavePerfil = () => ["perfil"] as const;

export function usePerfil() {
  return useQuery({
    queryKey: chavePerfil(),
    queryFn: async () => (await apiFetch<{ usuario: PerfilDTO }>("/api/perfil")).usuario,
  });
}
