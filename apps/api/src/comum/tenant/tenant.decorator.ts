import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { RequestComTenant } from "./tenant.guard";
import type { TenantContext } from "@dominio/lib/auth/resolver-tenant";

// Só é válido em handlers protegidos por TenantGuard — sem ele, falha alto em vez de
// devolver um contexto vazio que deixaria uma query sem escritorioId.
export const Tenant = createParamDecorator((_dado: unknown, context: ExecutionContext): TenantContext => {
  const tenant = context.switchToHttp().getRequest<RequestComTenant>().tenant;
  if (!tenant) {
    throw new Error("@Tenant() usado sem TenantGuard.");
  }
  return tenant;
});
