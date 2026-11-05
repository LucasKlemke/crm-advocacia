import { Body, Controller, Get, Inject, Patch, UseFilters, UseGuards } from "@nestjs/common";
import { TenantGuard } from "../comum/tenant/tenant.guard";
import { Tenant } from "../comum/tenant/tenant.decorator";
import { ErrosHttpFilter } from "../comum/erros-http.filter";
import { ValidacaoZodPipe } from "../comum/validacao.pipe";
import { ESCRITORIO_SERVICE } from "./tokens";
import { tratarErroDeEscritorio } from "./erros";
import { atualizarEscritorioSchema } from "@dominio/lib/api/schemas-escritorio";
import type { escritorioService, AtualizarEscritorioInput } from "@dominio/services/escritorio.service";
import type { TenantContext } from "@dominio/lib/auth/resolver-tenant";

// Escritório ativo da sessão. A criação (POST /api/escritorios) fica em
// sessao/criar-escritorio.controller.ts, porque troca o escritório ativo no cookie de sessão.
@Controller("escritorios/atual")
@UseGuards(TenantGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeEscritorio]))
export class EscritorioAtualController {
  constructor(@Inject(ESCRITORIO_SERVICE) private readonly service: typeof escritorioService) {}

  @Get()
  async obter(@Tenant() ctx: TenantContext) {
    return { escritorio: await this.service.obterEscritorioAtivo(ctx) };
  }

  @Patch()
  async atualizar(
    @Tenant() ctx: TenantContext,
    @Body(new ValidacaoZodPipe(atualizarEscritorioSchema)) dados: AtualizarEscritorioInput
  ) {
    return { escritorio: await this.service.atualizarEscritorio(ctx, dados) };
  }
}
