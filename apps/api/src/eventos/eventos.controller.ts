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
  Req,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { TenantGuard } from "../comum/tenant/tenant.guard";
import { Tenant } from "../comum/tenant/tenant.decorator";
import { ErrosHttpFilter } from "../comum/erros-http.filter";
import { ValidacaoZodPipe, DadosInvalidosError } from "../comum/validacao.pipe";
import { searchParamsDaRequisicao } from "../comum/query";
import { EVENTO_SERVICE, SERIALIZADOR_EVENTO, type SerializadorEvento } from "./tokens";
import {
  novoEventoSchema,
  edicaoEventoSchema,
  parseFiltrosEventosDaQuery,
} from "@crm/compartilhado/schemas/evento";
import { tratarErroDeEvento } from "@dominio/lib/api/erros-evento";
import type {
  eventoService,
  DadosNovoEvento,
  DadosEdicaoEvento,
} from "@dominio/services/evento.service";
import type { EventoComRelacoes } from "@dominio/lib/api/serializa-evento";
import type { TenantContext } from "@dominio/lib/auth/resolver-tenant";

// Agenda compartilhada do escritório (RN31). `podeEditar` de cada evento é resolvido
// com o membro da sessão (RN34) e viaja no DTO.
@Controller("eventos")
@UseGuards(TenantGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeEvento]))
export class EventosController {
  constructor(
    @Inject(EVENTO_SERVICE) private readonly service: typeof eventoService,
    @Inject(SERIALIZADOR_EVENTO) private readonly serializador: SerializadorEvento
  ) {}

  @Get()
  async listar(@Tenant() ctx: TenantContext, @Req() req: Request) {
    const filtros = parseFiltrosEventosDaQuery(searchParamsDaRequisicao(req));
    if (!filtros.success) {
      throw new DadosInvalidosError(filtros.error);
    }

    const membro = await this.service.membroAtual(ctx);
    const eventos = await this.service.listarNoPeriodo(ctx, {
      inicio: new Date(filtros.data.inicio),
      fim: new Date(filtros.data.fim),
    });

    return {
      eventos: await this.serializador.serializarEventos(eventos, (evento) =>
        this.service.podeEditar(ctx, membro.id, evento)
      ),
    };
  }

  // 201 (padrão do @Post). Recarrega com as relações: o cliente precisa do criador e dos
  // participantes hidratados para desenhar o evento sem uma segunda chamada.
  @Post()
  async criar(
    @Tenant() ctx: TenantContext,
    @Body(new ValidacaoZodPipe(novoEventoSchema)) dados: DadosNovoEvento
  ) {
    const criado = await this.service.criar(ctx, dados);
    const evento = await this.service.obter(ctx, criado.id);
    return { evento: await this.serializar(ctx, evento) };
  }

  @Get(":id")
  async obter(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    const evento = await this.service.obter(ctx, id);
    return { evento: await this.serializar(ctx, evento) };
  }

  @Patch(":id")
  async atualizar(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Body(new ValidacaoZodPipe(edicaoEventoSchema)) dados: DadosEdicaoEvento
  ) {
    await this.service.atualizar(ctx, id, dados);
    const evento = await this.service.obter(ctx, id);
    return { evento: await this.serializar(ctx, evento) };
  }

  @Delete(":id")
  @HttpCode(200)
  async excluir(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    await this.service.excluir(ctx, id);
    return { ok: true };
  }

  private async serializar(ctx: TenantContext, evento: EventoComRelacoes) {
    const membro = await this.service.membroAtual(ctx);
    return this.serializador.serializarEvento(evento, (e) =>
      this.service.podeEditar(ctx, membro.id, e)
    );
  }
}
