import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import type { z } from "zod";
import { TenantGuard } from "../comum/tenant/tenant.guard";
import { Tenant } from "../comum/tenant/tenant.decorator";
import { ErrosHttpFilter } from "../comum/erros-http.filter";
import { ValidacaoZodPipe } from "../comum/validacao.pipe";
import { CAMPANHAS_SERVICE } from "./tokens";
import {
  novaCampanhaSchema,
  acaoCampanhaSchema,
  paginaCampanhaSchema,
} from "@crm/compartilhado/schemas/campanha";
import { tratarErroDeCampanha } from "@dominio/lib/api/erros-campanha";
import type { campanhaService } from "@dominio/services/campanha.service";
import type { TenantContext } from "@dominio/lib/auth/resolver-tenant";

type CorpoNovaCampanha = z.output<typeof novaCampanhaSchema>;
type CorpoAcaoCampanha = z.output<typeof acaoCampanhaSchema>;

// Campanhas de disparo em massa via UAZAPI. O CSV chega já parseado pelo browser, como
// JSON em `linhas` (até MAX_DESTINATARIOS) — por isso o limite de 10 MB em configurarApp.
@Controller("campanhas")
@UseGuards(TenantGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeCampanha]))
export class CampanhasController {
  constructor(@Inject(CAMPANHAS_SERVICE) private readonly service: typeof campanhaService) {}

  @Get()
  async listar(@Tenant() ctx: TenantContext) {
    return { campanhas: await this.service.listar(ctx) };
  }

  @Post()
  async criar(
    @Tenant() ctx: TenantContext,
    @Body(new ValidacaoZodPipe(novaCampanhaSchema)) dados: CorpoNovaCampanha
  ) {
    // O schema valida a string ISO (e que é futura); o service trabalha com Date. Sem
    // agendamento a chave nem é repassada — a UAZAPI enfileira para envio imediato.
    const { agendadaPara, ...resto } = dados;
    const campanha = await this.service.criar(ctx, {
      ...resto,
      ...(agendadaPara ? { agendadaPara: new Date(agendadaPara) } : {}),
    });
    return { campanha };
  }

  // Campanha + página de itens numa resposta só: a tela de detalhe precisa dos dois, e
  // obter() roda antes para confirmar o tenant antes de tocar nos itens.
  @Get(":id")
  async obter(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Query("pagina", new ValidacaoZodPipe(paginaCampanhaSchema)) pagina: number
  ) {
    const campanha = await this.service.obter(ctx, id);
    const itens = await this.service.listarItens(ctx, id, { pagina });
    return { campanha, ...itens };
  }

  // Status mensagem a mensagem, consultado ao vivo na UAZAPI. Página inválida vira 1
  // (paginaCampanhaSchema usa .catch(1)), nunca 400.
  @Get(":id/mensagens")
  async mensagens(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Query("pagina", new ValidacaoZodPipe(paginaCampanhaSchema)) pagina: number
  ) {
    const { mensagens, total, truncado } = await this.service.listarMensagens(ctx, id, { pagina });
    return { mensagens, total, truncado };
  }

  @Post(":id/sincronizar")
  @HttpCode(200)
  async sincronizar(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    return { campanha: await this.service.sincronizar(ctx, id) };
  }

  // Pausar/retomar/excluir o envio na UAZAPI. Com acao="delete" a campanha deixa de
  // existir localmente e a resposta traz `campanha: null`.
  @Post(":id/controlar")
  @HttpCode(200)
  async controlar(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Body(new ValidacaoZodPipe(acaoCampanhaSchema)) corpo: CorpoAcaoCampanha
  ) {
    return { campanha: await this.service.controlar(ctx, id, corpo.acao) };
  }
}
