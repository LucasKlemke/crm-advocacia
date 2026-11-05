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
import { falhaExterna } from "../comum/falha-externa";
import { searchParamsDaRequisicao } from "../comum/query";
import { DOCUMENTO_SERVICE } from "../comum/tokens-documentos";
import {
  escopoDocumentoSchema,
  uploadDocumentoSchema,
  confirmarUploadDocumentoSchema,
  renomearDocumentoSchema,
  modoDownloadSchema,
} from "@dominio/lib/api/schemas-documento";
import { tratarErroDeCliente } from "@dominio/lib/api/erros-cliente";
import { tratarErroDeCaso } from "@dominio/lib/api/erros-caso";
import { tratarErroDeDocumento } from "@dominio/lib/api/erros-documento";
import { documentoParaPublico } from "@dominio/lib/documentos/publico";
import type { documentoService, UploadUrlInput } from "@dominio/services/documento.service";
import type { TenantContext } from "@dominio/lib/auth/resolver-tenant";

// Rotas que validam o escopo (cliente/caso) também mapeiam os erros desses services —
// mesma composição das rotas Next.
const TRADUTORES_COM_ESCOPO = [tratarErroDeCliente, tratarErroDeCaso, tratarErroDeDocumento];

// Documentos de cliente/caso no S3 (RN17/RN18). Toda resposta passa por
// documentoParaPublico: storageKey e autorMembroId nunca saem da API.
@Controller("documentos")
@UseGuards(TenantGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeDocumento]))
export class DocumentosController {
  constructor(@Inject(DOCUMENTO_SERVICE) private readonly service: typeof documentoService) {}

  @Get()
  @UseFilters(new ErrosHttpFilter(TRADUTORES_COM_ESCOPO))
  async listar(@Tenant() ctx: TenantContext, @Req() req: Request) {
    const searchParams = searchParamsDaRequisicao(req);
    const parsed = escopoDocumentoSchema.safeParse({
      escopo: searchParams.get("escopo"),
      escopoId: searchParams.get("escopoId"),
    });
    if (!parsed.success) {
      throw new DadosInvalidosError(parsed.error);
    }

    const documentos = await this.service.listarPorEscopo(ctx, parsed.data.escopo, parsed.data.escopoId);
    return { documentos: documentos.map(documentoParaPublico) };
  }

  @Post("upload-url")
  @HttpCode(200)
  @UseFilters(
    new ErrosHttpFilter([...TRADUTORES_COM_ESCOPO, falhaExterna("Não foi possível iniciar o upload.")])
  )
  async gerarUrlUpload(
    @Tenant() ctx: TenantContext,
    @Body(new ValidacaoZodPipe(uploadDocumentoSchema)) dados: UploadUrlInput
  ) {
    return this.service.gerarUrlUpload(ctx, dados);
  }

  @Patch(":id")
  async renomear(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Body(new ValidacaoZodPipe(renomearDocumentoSchema)) dados: { nomeArquivo: string }
  ) {
    const documento = await this.service.renomear(ctx, id, dados.nomeArquivo);
    return { documento: documentoParaPublico(documento) };
  }

  @Delete(":id")
  @HttpCode(200)
  async excluir(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    await this.service.excluir(ctx, id);
    return { ok: true };
  }

  // 201 (padrão do @Post), como a rota Next.
  @Post(":id/confirmar")
  @UseFilters(new ErrosHttpFilter(TRADUTORES_COM_ESCOPO))
  async confirmar(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Body(new ValidacaoZodPipe(confirmarUploadDocumentoSchema)) dados: UploadUrlInput
  ) {
    const documento = await this.service.confirmarUpload(ctx, id, dados);
    return { documento: documentoParaPublico(documento) };
  }

  @Get(":id/download-url")
  @UseFilters(
    new ErrosHttpFilter([tratarErroDeDocumento, falhaExterna("Não foi possível gerar o link de download.")])
  )
  async gerarUrlDownload(@Tenant() ctx: TenantContext, @Param("id") id: string, @Req() req: Request) {
    const parsed = modoDownloadSchema.safeParse({
      modo: searchParamsDaRequisicao(req).get("modo") ?? undefined,
    });
    if (!parsed.success) {
      throw new DadosInvalidosError(parsed.error);
    }

    const downloadUrl = await this.service.gerarUrlDownload(ctx, id, parsed.data.modo === "inline");
    return { downloadUrl };
  }
}
