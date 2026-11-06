import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { MembroLinha } from "@/components/configuracoes/membros-table";
import type { ConviteLinha } from "@/components/configuracoes/convites-table";

export const chaveMembros = () => ["membros"] as const;
export const chaveConvites = () => ["convites"] as const;

// A API devolve o membro inteiro (com avatar já assinado). A tabela recebe só o que
// exibe, como a página server fazia.
export function useMembros() {
  return useQuery({
    queryKey: chaveMembros(),
    queryFn: async (): Promise<MembroLinha[]> => {
      const { membros } = await apiFetch<{ membros: MembroLinha[] }>("/api/membros");
      return membros.map((membro) => ({
        id: membro.id,
        role: membro.role,
        usuario: {
          id: membro.usuario.id,
          nome: membro.usuario.nome,
          email: membro.usuario.email,
          telefone: membro.usuario.telefone,
          avatarUrl: membro.usuario.avatarUrl,
        },
      }));
    },
  });
}

// Convites são só de quem gerencia membros: o papel padrao recebe 403, então a query
// nem dispara para ele.
export function useConvitesPendentes(habilitado: boolean) {
  return useQuery({
    queryKey: chaveConvites(),
    enabled: habilitado,
    queryFn: async (): Promise<ConviteLinha[]> => {
      const { convites } = await apiFetch<{ convites: ConviteLinha[] }>("/api/convites");
      return convites.map((convite) => ({ id: convite.id, email: convite.email, role: convite.role }));
    },
  });
}
