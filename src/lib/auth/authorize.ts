import bcrypt from "bcrypt";
import { usuarioRepository } from "@/repositories/usuario.repository";
import { resolverEscritorioAtivo } from "@/lib/auth/escritorio-ativo";
import type { RoleMembro } from "@prisma/client";

export interface UsuarioAutenticado {
  id: string;
  email: string;
  name: string;
  escritorioId: string | null;
  role: RoleMembro | null;
}

// Lógica de autenticação por credenciais (e-mail/senha), extraída do provider do
// NextAuth para ser testável isoladamente. Usuário inativo nunca autentica (RN02a).
// Escritório inicial da sessão é a membership mais antiga do usuário (0 memberships -> null).
export async function authorizeCredentials(
  email: unknown,
  senha: unknown
): Promise<UsuarioAutenticado | null> {
  if (typeof email !== "string" || typeof senha !== "string") {
    return null;
  }

  const usuario = await usuarioRepository.findByEmail(email);
  if (!usuario || !usuario.ativo) {
    return null;
  }

  const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
  if (!senhaValida) {
    return null;
  }

  const { escritorioId, role } = await resolverEscritorioAtivo(usuario.id, null);

  return {
    id: usuario.id,
    email: usuario.email,
    name: usuario.nome,
    escritorioId,
    role,
  };
}
