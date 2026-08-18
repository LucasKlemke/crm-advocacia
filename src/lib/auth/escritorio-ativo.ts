import { membroRepository } from "@/repositories/membro.repository";
import type { RoleMembro } from "@prisma/client";

export interface EscritorioAtivoResolvido {
  escritorioId: string | null;
  role: RoleMembro | null;
}

// Resolve o escritório ativo da sessão sempre consultando o banco — nunca confia em
// payload cru vindo do client (ex. do POST /api/auth/session, que é público).
//
// - escritorioIdDesejado válido (usuário é membro) -> usa ele.
// - escritorioIdDesejado ausente/inválido -> cai para a membership mais antiga.
// - usuário sem nenhuma membership -> null/null.
export async function resolverEscritorioAtivo(
  usuarioId: string,
  escritorioIdDesejado?: string | null
): Promise<EscritorioAtivoResolvido> {
  if (escritorioIdDesejado) {
    const membro = await membroRepository.findByUsuarioEEscritorio(
      usuarioId,
      escritorioIdDesejado
    );
    if (membro) {
      return { escritorioId: membro.escritorioId, role: membro.role };
    }
  }

  const memberships = await membroRepository.listarPorUsuario(usuarioId);
  const primeira = memberships[0];

  if (!primeira) {
    return { escritorioId: null, role: null };
  }

  return { escritorioId: primeira.escritorioId, role: primeira.role };
}
