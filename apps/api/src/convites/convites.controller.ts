import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import { TenantGuard } from "../comum/tenant/tenant.guard";
import { Tenant } from "../comum/tenant/tenant.decorator";
import { ErrosHttpFilter } from "../comum/erros-http.filter";
import { ValidacaoZodPipe } from "../comum/validacao.pipe";
import { CONVITE_SERVICE } from "./tokens";
import { tratarErroDeConvite } from "./erros";
import { convidarSchema } from "@/lib/api/schemas-convite";
import type { conviteService, ConvidarInput } from "@/services/convite.service";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

@Controller("convites")
@UseGuards(TenantGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeConvite]))
export class ConvitesController {
  constructor(@Inject(CONVITE_SERVICE) private readonly service: typeof conviteService) {}

  @Get()
  async listar(@Tenant() ctx: TenantContext) {
    return { convites: await this.service.listarPendentes(ctx) };
  }

  // 201 (padrão do @Post) com o ConvidarResult como corpo — igual à rota Next.
  @Post()
  async convidar(
    @Tenant() ctx: TenantContext,
    @Body(new ValidacaoZodPipe(convidarSchema)) dados: ConvidarInput
  ) {
    return this.service.convidar(ctx, dados);
  }

  @Delete(":id")
  @HttpCode(200)
  async cancelar(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    await this.service.cancelar(ctx, id);
    return { ok: true };
  }
}
