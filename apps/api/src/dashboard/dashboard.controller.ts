import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { TenantGuard } from "../comum/tenant/tenant.guard";
import { Tenant } from "../comum/tenant/tenant.decorator";
import { searchParamsDaRequisicao } from "../comum/query";
import { DASHBOARD_SERVICE } from "./tokens";
import { parseFiltrosCasoDaQuery } from "@/lib/api/schemas-caso";
import type { dashboardService } from "@/services/dashboard.service";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

// Sem tradutores de domínio: o resumo só falha por tenant (filtro global) ou erro
// inesperado (500 genérico).
@Controller("dashboard")
@UseGuards(TenantGuard)
export class DashboardController {
  constructor(@Inject(DASHBOARD_SERVICE) private readonly service: typeof dashboardService) {}

  @Get("resumo")
  async resumo(@Tenant() ctx: TenantContext, @Req() req: Request) {
    // Mesmo filtro do header de /casos aplicado a todo o resumo — só o subconjunto
    // cliente/responsável/período faz sentido fora da tabela.
    const { clienteIds, responsavelIds, dataInicio, dataFim } = parseFiltrosCasoDaQuery(
      searchParamsDaRequisicao(req)
    );
    return this.service.resumo(ctx, { clienteIds, responsavelIds, dataInicio, dataFim });
  }
}
