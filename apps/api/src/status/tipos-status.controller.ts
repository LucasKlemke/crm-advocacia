import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { TenantGuard } from "../comum/tenant/tenant.guard";
import { Tenant } from "../comum/tenant/tenant.decorator";
import { TIPO_STATUS_SERVICE } from "./tokens";
import type { tipoStatusService } from "@/services/tipo-status.service";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

// Referência global (seed fixo), mas só para quem tem sessão num escritório.
@Controller("tipos-status")
@UseGuards(TenantGuard)
export class TiposStatusController {
  constructor(@Inject(TIPO_STATUS_SERVICE) private readonly service: typeof tipoStatusService) {}

  @Get()
  async listar(@Tenant() ctx: TenantContext) {
    return { tipos: await this.service.listar(ctx) };
  }
}
