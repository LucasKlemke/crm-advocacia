import type { Request } from "express";
import { resolverTenantContext, NaoAutenticadoError, type TenantContext } from "@/lib/auth/resolver-tenant";
import { lerSessaoDaRequisicao } from "../sessao/cookie-sessao";

export const RESOLVEDOR_TENANT = Symbol("RESOLVEDOR_TENANT");
export type ResolvedorTenant = (req: Request) => Promise<TenantContext>;

export const RESOLVEDOR_USUARIO = Symbol("RESOLVEDOR_USUARIO");
export type ResolvedorUsuario = (req: Request) => Promise<string>;

// Utilitário para quem precisa da interface Headers do fetch a partir do Express.
export function headersDaRequisicao(req: Request): Headers {
  const headers = new Headers();
  for (const [nome, valor] of Object.entries(req.headers)) {
    if (valor === undefined) continue;
    headers.set(nome, Array.isArray(valor) ? valor.join(", ") : valor);
  }
  return headers;
}

// Fase 3: a sessão é o cookie crm_sessao (src/lib/auth/sessao-jwt.ts). O JWT só informa
// quem é o usuário e qual escritório está ativo; papel e membership vêm do banco via
// resolverTenantContext — a mesma regra que o getTenantContext() do Next usa (RN19).
export async function resolverTenantDaRequisicao(req: Request): Promise<TenantContext> {
  const sessao = await lerSessaoDaRequisicao(req);
  return resolverTenantContext(sessao ? { usuarioId: sessao.sub, escritorioId: sessao.escritorioId } : null);
}

// Rotas fora de tenant (perfil, criação de escritório, troca de escritório): só exigem
// um usuário autenticado.
export async function resolverUsuarioDaRequisicao(req: Request): Promise<string> {
  const sessao = await lerSessaoDaRequisicao(req);
  if (!sessao) {
    throw new NaoAutenticadoError();
  }
  return sessao.sub;
}
