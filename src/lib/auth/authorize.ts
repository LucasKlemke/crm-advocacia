import bcrypt from "bcrypt";
import { usuarioRepository } from "@/repositories/usuario.repository";

export interface UsuarioAutenticado {
  id: string;
  email: string;
  name: string;
  escritorioId: string;
  role: string;
}

// Lógica de autenticação por credenciais (e-mail/senha), extraída do provider do
// NextAuth para ser testável isoladamente. Usuário inativo nunca autentica (RN02a).
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

  return {
    id: usuario.id,
    email: usuario.email,
    name: usuario.nome,
    escritorioId: usuario.escritorioId,
    role: usuario.role,
  };
}
