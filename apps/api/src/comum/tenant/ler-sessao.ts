import type { Request } from "express";
import { lerTokenDaSessao } from "@/lib/auth/token";
import { resolverTenantContext, type TenantContext } from "@/lib/auth/resolver-tenant";

export const RESOLVEDOR_TENANT = Symbol("RESOLVEDOR_TENANT");
export type ResolvedorTenant = (req: Request) => Promise<TenantContext>;

// lerTokenDaSessao espera a interface Headers do fetch; o Express entrega um objeto.
export function headersDaRequisicao(req: Request): Headers {
  const headers = new Headers();
  for (const [nome, valor] of Object.entries(req.headers)) {
    if (valor === undefined) continue;
    headers.set(nome, Array.isArray(valor) ? valor.join(", ") : valor);
  }
  return headers;
}

// Fase 1–2: a sessão ainda é a do NextAuth (mesmo cookie, mesmo AUTH_SECRET). O JWT só
// informa quem é o usuário e qual escritório está ativo; papel e membership vêm do banco
// via resolverTenantContext — a mesma regra que o getTenantContext() do Next usa.
export async function resolverTenantDaRequisicao(req: Request): Promise<TenantContext> {
  const token = await lerTokenDaSessao({ headers: headersDaRequisicao(req) });
  return resolverTenantContext(
    token
      ? {
          usuarioId: token.sub ?? null,
          escritorioId: (token.escritorioId as string | null | undefined) ?? null,
        }
      : null
  );
}
