import { cookies } from "next/headers";
import { NOME_COOKIE_SESSAO_CRM, verificarSessao, type SessaoJwt } from "@/lib/auth/sessao-jwt";
import { usuarioService } from "@/services/usuario.service";

// Leitura da sessão em Server Components (substitui auth() do NextAuth). Só lê: quem
// grava o cookie é a API Nest (SessaoModule). Some na Fase 4, com os Server Components.

export async function lerSessaoDoServidor(): Promise<SessaoJwt | null> {
  const loja = await cookies();
  return verificarSessao(loja.get(NOME_COOKIE_SESSAO_CRM)?.value);
}

export interface UsuarioDaSessao {
  id: string;
  nome: string;
  email: string;
}

// Nome/e-mail saem do banco, não do JWT. Isso também corrige o nome desatualizado depois
// de editar o perfil, que o JWT do NextAuth mantinha até o próximo login.
export async function obterUsuarioDaSessao(): Promise<UsuarioDaSessao | null> {
  const sessao = await lerSessaoDoServidor();
  if (!sessao) return null;

  const usuario = await usuarioService.obterPerfil(sessao.sub);
  if (!usuario || !usuario.ativo) return null;

  return { id: usuario.id, nome: usuario.nome, email: usuario.email };
}
