import { Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { RESOLVEDOR_TENANT, type ResolvedorTenant } from "./ler-sessao";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

export type RequestComTenant = Request & { tenant?: TenantContext };

// Guard de tenant (RN19): sem contexto resolvido, o handler não
// roda. Os erros de tenant sobem para o ErrosHttpFilter (401/409/403).
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(@Inject(RESOLVEDOR_TENANT) private readonly resolver: ResolvedorTenant) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestComTenant>();
    req.tenant = await this.resolver(req);
    return true;
  }
}
