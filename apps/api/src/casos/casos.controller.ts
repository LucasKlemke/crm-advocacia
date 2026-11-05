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
  Res,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response as ExpressResponse } from "express";
import { TenantGuard } from "../comum/tenant/tenant.guard";
import { Tenant } from "../comum/tenant/tenant.decorator";
import { ErrosHttpFilter } from "../comum/erros-http.filter";
import { ValidacaoZodPipe } from "../comum/validacao.pipe";
import { paginaDaQuery, searchParamsDaRequisicao } from "../comum/query";
import { erroAoGerarZip, responderZip } from "../comum/resposta-zip";
import { DOCUMENTO_SERVICE, ZIP_DOCUMENTOS } from "../comum/tokens-documentos";
import { CASO_SERVICE, PAYLOADS_CASO, type PayloadsCaso } from "./tokens";
import { novoCasoSchema, edicaoCasoSchema, parseFiltrosCasoDaQuery } from "@/lib/api/schemas-caso";
import { tratarErroDeCaso } from "@/lib/api/erros-caso";
import { serializarCaso, serializarCasos } from "@/lib/api/serializa-caso";
import type { casoService, DadosNovoCaso, DadosEdicaoCaso } from "@/services/caso.service";
import type { documentoService } from "@/services/documento.service";
import type { montarZipDocumentos } from "@/lib/documentos/zip";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

// Processos do escritório (RN06–RN09). Toda resposta com caso passa por serializarCaso
// (tira o senhaHash do responsável e assina o avatar), exceto o POST, que devolve o
// registro criado cru — o mesmo contrato da rota Next.
//
// Ordem dos métodos importa: "filtros" e "kanban" vêm antes de ":id", porque o Express
// casa as rotas na ordem de registro.
@Controller("casos")
@UseGuards(TenantGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeCaso]))
export class CasosController {
  constructor(
    @Inject(CASO_SERVICE) private readonly service: typeof casoService,
    @Inject(PAYLOADS_CASO) private readonly payloads: PayloadsCaso,
    @Inject(DOCUMENTO_SERVICE)
    private readonly documentos: Pick<typeof documentoService, "listarPorEscopo">,
    @Inject(ZIP_DOCUMENTOS) private readonly montarZip: typeof montarZipDocumentos
  ) {}

  // Payload único com as opções dos dropdowns de filtro (clientes, membros, status,
  // tipos de status e tipos de processo).
  @Get("filtros")
  filtros(@Tenant() ctx: TenantContext) {
    return this.payloads.montarOpcoesFiltroCaso(ctx);
  }

  @Get("kanban")
  async kanban(@Tenant() ctx: TenantContext, @Req() req: Request) {
    const filtros = parseFiltrosCasoDaQuery(searchParamsDaRequisicao(req));
    const colunas = await this.service.listarKanban(ctx, filtros);
    return {
      colunas: await Promise.all(
        colunas.map(async (coluna) => ({ ...coluna, casos: await serializarCasos(coluna.casos) }))
      ),
    };
  }

  @Get()
  listar(@Tenant() ctx: TenantContext, @Req() req: Request) {
    const params = searchParamsDaRequisicao(req);
    return this.payloads.montarListaCasos(ctx, parseFiltrosCasoDaQuery(params), paginaDaQuery(params));
  }

  @Post()
  async criar(
    @Tenant() ctx: TenantContext,
    @Body(new ValidacaoZodPipe(novoCasoSchema)) dados: DadosNovoCaso
  ) {
    return { caso: await this.service.criar(ctx, dados) };
  }

  @Get(":id")
  async obter(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    return { caso: await serializarCaso(await this.service.obter(ctx, id)) };
  }

  @Patch(":id")
  async atualizar(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Body(new ValidacaoZodPipe(edicaoCasoSchema)) dados: DadosEdicaoCaso
  ) {
    return { caso: await serializarCaso(await this.service.atualizar(ctx, id, dados)) };
  }

  // Não é exclusão: caso nunca é apagado, só arquivado (RN08/RN09). DELETE é a semântica
  // REST que o client usa para "remover da visão ativa".
  @Delete(":id")
  @HttpCode(200)
  async arquivar(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    return { caso: await serializarCaso(await this.service.arquivar(ctx, id)) };
  }

  @Get(":id/documentos/download-todos")
  @UseFilters(new ErrosHttpFilter([tratarErroDeCaso, erroAoGerarZip]))
  async baixarTodos(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Res() res: ExpressResponse
  ) {
    const caso = await this.service.obter(ctx, id);
    const documentos = await this.documentos.listarPorEscopo(ctx, "caso", id);
    responderZip(res, this.montarZip(documentos), `documentos-caso-${caso.tipoProcesso.nome}.zip`);
  }
}
