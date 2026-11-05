import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import { TenantGuard } from "../comum/tenant/tenant.guard";
import { Tenant } from "../comum/tenant/tenant.decorator";
import { ErrosHttpFilter } from "../comum/erros-http.filter";
import { ValidacaoZodPipe } from "../comum/validacao.pipe";
import { STATUS_SERVICE } from "./tokens";
import { novoStatusSchema, edicaoStatusSchema } from "@/lib/api/schemas-status";
import { tratarErroDeStatus } from "@/lib/api/erros-status";
import type { statusService } from "@/services/status.service";
import type { DadosNovoStatus, DadosEdicaoStatus } from "@/services/status.service";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

// Colunas do kanban configuráveis pelo escritório (RN08/RN09).
@Controller("status")
@UseGuards(TenantGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeStatus]))
export class StatusController {
  constructor(@Inject(STATUS_SERVICE) private readonly service: typeof statusService) {}

  @Get()
  async listar(@Tenant() ctx: TenantContext) {
    return { status: await this.service.listar(ctx) };
  }

  @Post()
  async criar(
    @Tenant() ctx: TenantContext,
    @Body(new ValidacaoZodPipe(novoStatusSchema)) dados: DadosNovoStatus
  ) {
    return { status: await this.service.criar(ctx, dados) };
  }

  @Patch(":id")
  async atualizar(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Body(new ValidacaoZodPipe(edicaoStatusSchema)) dados: DadosEdicaoStatus
  ) {
    return { status: await this.service.atualizar(ctx, id, dados) };
  }

  @Delete(":id")
  @HttpCode(200)
  async excluir(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    await this.service.excluir(ctx, id);
    return { ok: true };
  }
}
