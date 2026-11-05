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
import { TIPO_PROCESSO_SERVICE } from "./tokens";
import { novoTipoProcessoSchema, edicaoTipoProcessoSchema } from "@crm/compartilhado/schemas/tipo-processo";
import { tratarErroDeTipoProcesso } from "@dominio/lib/api/erros-tipo-processo";
import type {
  tipoProcessoService,
  DadosNovoTipoProcesso,
  DadosEdicaoTipoProcesso,
} from "@dominio/services/tipo-processo.service";
import type { TenantContext } from "@dominio/lib/auth/resolver-tenant";

// Natureza do processo, cadastrada pelo escritório (RN22). Escrita restrita a
// owner/admin: a regra está no service, que lança PermissaoNegadaError (403).
@Controller("tipos-processo")
@UseGuards(TenantGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeTipoProcesso]))
export class TiposProcessoController {
  constructor(
    @Inject(TIPO_PROCESSO_SERVICE) private readonly service: typeof tipoProcessoService
  ) {}

  @Get()
  async listar(@Tenant() ctx: TenantContext) {
    return { tipos: await this.service.listar(ctx) };
  }

  @Post()
  async criar(
    @Tenant() ctx: TenantContext,
    @Body(new ValidacaoZodPipe(novoTipoProcessoSchema)) dados: DadosNovoTipoProcesso
  ) {
    return { tipo: await this.service.criar(ctx, dados) };
  }

  @Patch(":id")
  async atualizar(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Body(new ValidacaoZodPipe(edicaoTipoProcessoSchema)) dados: DadosEdicaoTipoProcesso
  ) {
    return { tipo: await this.service.atualizar(ctx, id, dados) };
  }

  @Delete(":id")
  @HttpCode(200)
  async excluir(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    await this.service.excluir(ctx, id);
    return { ok: true };
  }
}
