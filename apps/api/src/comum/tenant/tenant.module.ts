import { Global, Module } from "@nestjs/common";
import { RESOLVEDOR_TENANT, resolverTenantDaRequisicao } from "./ler-sessao";
import { TenantGuard } from "./tenant.guard";

@Global()
@Module({
  providers: [{ provide: RESOLVEDOR_TENANT, useValue: resolverTenantDaRequisicao }, TenantGuard],
  exports: [RESOLVEDOR_TENANT, TenantGuard],
})
export class TenantModule {}
