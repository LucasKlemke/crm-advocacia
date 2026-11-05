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
import { INSTANCIAS_SERVICE } from "./tokens";
import { novaInstanciaWhatsappSchema } from "@/lib/api/schemas-instancia-whatsapp";
import { tratarErroDeInstanciaWhatsapp } from "@/lib/api/erros-instancia-whatsapp";
import type {
  instanciaWhatsappService,
  DadosNovaInstanciaWhatsapp,
} from "@/services/instancia-whatsapp.service";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

// Instâncias UAZAPI do escritório (RN30: excluir é soft delete, feito no service).
// Os POST de ação respondem 200 como as rotas Next — o padrão do Nest seria 201.
@Controller("instancias")
@UseGuards(TenantGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeInstanciaWhatsapp]))
export class InstanciasController {
  constructor(
    @Inject(INSTANCIAS_SERVICE) private readonly service: typeof instanciaWhatsappService
  ) {}

  @Get()
  async listar(@Tenant() ctx: TenantContext) {
    return { instancias: await this.service.listar(ctx) };
  }

  @Post()
  async criar(
    @Tenant() ctx: TenantContext,
    @Body(new ValidacaoZodPipe(novaInstanciaWhatsappSchema)) dados: DadosNovaInstanciaWhatsapp
  ) {
    const { instancia, qrcode, paircode } = await this.service.criarEConectar(ctx, dados);
    return { instancia, qrcode, paircode };
  }

  @Post("sincronizar")
  @HttpCode(200)
  async sincronizar(@Tenant() ctx: TenantContext) {
    return { instancias: await this.service.sincronizarTodas(ctx) };
  }

  @Delete(":id")
  @HttpCode(200)
  async excluir(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    await this.service.excluir(ctx, id);
    return { ok: true };
  }

  @Get(":id/status")
  async status(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    return { instancia: await this.service.verificarStatus(ctx, id) };
  }

  @Post(":id/desconectar")
  @HttpCode(200)
  async desconectar(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    return { instancia: await this.service.desconectar(ctx, id) };
  }

  @Post(":id/reconectar")
  @HttpCode(200)
  async reconectar(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    const { instancia, qrcode, paircode } = await this.service.reconectar(ctx, id);
    return { instancia, qrcode, paircode };
  }
}
