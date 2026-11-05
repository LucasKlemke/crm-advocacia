import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import type { RoleMembro } from "@prisma/client";
import { TenantGuard } from "../comum/tenant/tenant.guard";
import { Tenant } from "../comum/tenant/tenant.decorator";
import { ErrosHttpFilter } from "../comum/erros-http.filter";
import { ValidacaoZodPipe } from "../comum/validacao.pipe";
import { MEMBRO_SERVICE } from "./tokens";
import { tratarErroDeMembro } from "./erros";
import { alterarRoleSchema } from "@/lib/api/schemas-membro";
import type { membroService } from "@/services/membro.service";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

// Gestão de usuários do escritório (RN02a): as regras de quem pode promover/remover
// ficam no membroService.
@Controller("membros")
@UseGuards(TenantGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeMembro]))
export class MembrosController {
  constructor(@Inject(MEMBRO_SERVICE) private readonly service: typeof membroService) {}

  @Get()
  async listar(@Tenant() ctx: TenantContext) {
    return { membros: await this.service.listarMembros(ctx) };
  }

  @Patch(":id")
  async alterarRole(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Body(new ValidacaoZodPipe(alterarRoleSchema)) dados: { role: RoleMembro }
  ) {
    return { membro: await this.service.alterarRole(ctx, id, dados.role) };
  }

  @Delete(":id")
  @HttpCode(200)
  async remover(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    await this.service.remover(ctx, id);
    return { ok: true };
  }
}
