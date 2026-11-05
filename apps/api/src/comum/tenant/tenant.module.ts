import { Global, Module } from "@nestjs/common";
import {
  RESOLVEDOR_TENANT,
  RESOLVEDOR_USUARIO,
  resolverTenantDaRequisicao,
  resolverUsuarioDaRequisicao,
} from "./ler-sessao";
import { TenantGuard } from "./tenant.guard";
import { UsuarioGuard } from "./usuario.guard";

@Global()
@Module({
  providers: [
    { provide: RESOLVEDOR_TENANT, useValue: resolverTenantDaRequisicao },
    { provide: RESOLVEDOR_USUARIO, useValue: resolverUsuarioDaRequisicao },
    TenantGuard,
    UsuarioGuard,
  ],
  exports: [RESOLVEDOR_TENANT, RESOLVEDOR_USUARIO, TenantGuard, UsuarioGuard],
})
export class TenantModule {}
