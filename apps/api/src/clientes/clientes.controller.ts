import {
  Body,
  Controller,
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
import { CLIENTE_SERVICE, POR_PAGINA_CLIENTES } from "./tokens";
import {
  novoClienteSchema,
  edicaoClienteSchema,
  acaoEmLoteClientesSchema,
  type AcaoEmLoteClientes,
} from "@/lib/api/schemas-cliente";
import { tratarErroDeCliente } from "@/lib/api/erros-cliente";
import type {
  clienteService,
  DadosNovoCliente,
  DadosEdicaoCliente,
} from "@/services/cliente.service";
import type { documentoService } from "@/services/documento.service";
import type { montarZipDocumentos } from "@/lib/documentos/zip";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

// Cadastro de clientes (RN04/RN05). Cliente nunca é apagado: "desativar" é soft delete,
// reversível pela ação em lote "restaurar".
@Controller("clientes")
@UseGuards(TenantGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeCliente]))
export class ClientesController {
  constructor(
    @Inject(CLIENTE_SERVICE) private readonly service: typeof clienteService,
    @Inject(DOCUMENTO_SERVICE)
    private readonly documentos: Pick<typeof documentoService, "listarPorEscopo">,
    @Inject(ZIP_DOCUMENTOS) private readonly montarZip: typeof montarZipDocumentos
  ) {}

  @Get()
  async listar(@Tenant() ctx: TenantContext, @Req() req: Request) {
    const params = searchParamsDaRequisicao(req);
    const pagina = paginaDaQuery(params);

    const { clientes, total } = await this.service.listar(ctx, {
      busca: params.get("busca") ?? undefined,
      incluirExcluidos: params.get("incluirExcluidos") === "true",
      skip: (pagina - 1) * POR_PAGINA_CLIENTES,
      take: POR_PAGINA_CLIENTES,
    });

    return { clientes, total, pagina, porPagina: POR_PAGINA_CLIENTES };
  }

  @Post()
  async criar(
    @Tenant() ctx: TenantContext,
    @Body(new ValidacaoZodPipe(novoClienteSchema)) dados: DadosNovoCliente
  ) {
    return { cliente: await this.service.criar(ctx, dados) };
  }

  // A rota Next respondia 200 (não 201): não cria recurso, só muda estado de vários.
  @Post("lote")
  @HttpCode(200)
  async acaoEmLote(
    @Tenant() ctx: TenantContext,
    @Body(new ValidacaoZodPipe(acaoEmLoteClientesSchema)) { ids, acao }: AcaoEmLoteClientes
  ) {
    return acao === "desativar"
      ? this.service.desativarEmLote(ctx, ids)
      : this.service.restaurarEmLote(ctx, ids);
  }

  @Get(":id")
  async obter(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    return { cliente: await this.service.obter(ctx, id) };
  }

  @Patch(":id")
  async atualizar(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Body(new ValidacaoZodPipe(edicaoClienteSchema)) dados: DadosEdicaoCliente
  ) {
    return { cliente: await this.service.atualizar(ctx, id, dados) };
  }

  // Resposta em stream: @Res() tira o Nest da serialização. Erros antes do stream (tenant,
  // cliente de outro escritório) ainda passam pelo filtro: 401/409/403/404, e o resto
  // vira 502 como na rota Next. O filtro de método substitui o do controller, por isso
  // repete tratarErroDeCliente.
  @Get(":id/documentos/download-todos")
  @UseFilters(new ErrosHttpFilter([tratarErroDeCliente, erroAoGerarZip]))
  async baixarTodos(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Res() res: ExpressResponse
  ) {
    const cliente = await this.service.obter(ctx, id);
    const documentos = await this.documentos.listarPorEscopo(ctx, "cliente", id);
    responderZip(res, this.montarZip(documentos), `documentos-cliente-${cliente.nome}.zip`);
  }
}
