import type { RoleMembro } from "@prisma/client";
import { useSessao } from "@/lib/sessao";

export interface SessaoDoEscritorio {
  usuario: { id: string; nome: string; email: string };
  escritorioId: string;
  role: RoleMembro;
}

// Páginas do dashboard só montam sob <RotaProtegida> com escritório ativo, que já
// redirecionou quem não tem sessão ou escritório. Este hook estreita o tipo para essas
// páginas e falha alto se alguém montá-lo fora dessa garantia, em vez de deixar uma
// tela checar papel contra null. (useSessao é um useQuery no queryClientRaiz; aqui só
// se lê o dado já carregado pela RotaProtegida.)
export function useSessaoDoEscritorio(): SessaoDoEscritorio {
  const sessao = useSessao().data;
  if (!sessao?.escritorioId || !sessao.role) {
    throw new Error("useSessaoDoEscritorio usado fora de RotaProtegida com escritório ativo.");
  }
  return { usuario: sessao.usuario, escritorioId: sessao.escritorioId, role: sessao.role };
}
