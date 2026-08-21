import { membroRepository } from "@/repositories/membro.repository";
import type { RoleMembro } from "@prisma/client";

export interface EscritorioAtivoResolvido {
  escritorioId: string | null;
  role: RoleMembro | null;
}

// Resolve o escritório ativo da sessão sempre consultando o banco — nunca confia em
// payload cru vindo do client (ex. do POST /api/auth/session, que é público).
//
// - escritorioIdDesejado é uma membership válida com escritório ativo -> usa ele.
// - escritorioIdDesejado ausente/inválido/inativo -> cai para a membership ativa mais antiga.
// - usuário sem nenhuma membership com escritório ativo -> null/null.
export async function resolverEscritorioAtivo(
  usuarioId: string,
  escritorioIdDesejado?: string | null
): Promise<EscritorioAtivoResolvido> {
  const memberships = await membroRepository.listarComEscritorioPorUsuario(usuarioId);
  const membershipsAtivas = memberships.filter((membro) => membro.escritorio.ativo);

  if (escritorioIdDesejado) {
    const desejada = membershipsAtivas.find(
      (membro) => membro.escritorioId === escritorioIdDesejado
    );
    if (desejada) {
      return { escritorioId: desejada.escritorioId, role: desejada.role };
    }
  }

  const primeira = membershipsAtivas[0];

  if (!primeira) {
    return { escritorioId: null, role: null };
  }

  return { escritorioId: primeira.escritorioId, role: primeira.role };
}
