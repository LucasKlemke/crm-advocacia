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
import { DadosInvalidosError, ValidacaoZodPipe } from "../comum/validacao.pipe";
import { searchParamsDaRequisicao } from "../comum/query";
import { COMENTARIO_SERVICE, USUARIO_SERVICE } from "./tokens";
import {
  filtroComentariosSchema,
  novoComentarioSchema,
  edicaoComentarioSchema,
  type NovoComentario,
  type EdicaoComentario,
} from "@/lib/api/schemas-comentario";
import { tratarErroDeCliente } from "@/lib/api/erros-cliente";
import { tratarErroDeCaso } from "@/lib/api/erros-caso";
import { tratarErroDeComentario } from "@/lib/api/erros-comentario";
import type { comentarioService } from "@/services/comentario.service";
import type { usuarioService } from "@/services/usuario.service";
import type { TenantContext } from "@/lib/auth/resolver-tenant";

// Comentários de cliente e caso (RN21). O service valida o alvo contra o tenant e lança
// ClienteNaoEncontradoError/CasoNaoEncontradoError (404) quando o alvo é de outro
// escritório, por isso os tradutores de cliente e caso também entram aqui.
@Controller("comentarios")
@UseGuards(TenantGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeCliente, tratarErroDeCaso, tratarErroDeComentario]))
export class ComentariosController {
  constructor(
    @Inject(COMENTARIO_SERVICE) private readonly service: typeof comentarioService,
    @Inject(USUARIO_SERVICE)
    private readonly usuarios: Pick<typeof usuarioService, "assinarUrlAvatar">
  ) {}

  @Get()
  async listar(@Tenant() ctx: TenantContext, @Req() req: Request) {
    const params = searchParamsDaRequisicao(req);
    const parsed = filtroComentariosSchema.safeParse({
      escopo: params.get("escopo"),
      escopoId: params.get("escopoId"),
    });
    if (!parsed.success) throw new DadosInvalidosError(parsed.error);

    const comentarios = await this.service.listar(ctx, parsed.data.escopo, parsed.data.escopoId);
    return {
      comentarios: await Promise.all(
        comentarios.map(async (comentario) => ({
          ...comentario,
          autor: {
            ...comentario.autor,
            avatarUrl: await this.usuarios.assinarUrlAvatar(comentario.autor.avatarUrl),
          },
        }))
      ),
    };
  }

  @Post()
  async criar(
    @Tenant() ctx: TenantContext,
    @Body(new ValidacaoZodPipe(novoComentarioSchema)) { escopo, escopoId, conteudo }: NovoComentario
  ) {
    return { comentario: await this.service.criar(ctx, escopo, escopoId, conteudo) };
  }

  @Patch(":id")
  async atualizar(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Body(new ValidacaoZodPipe(edicaoComentarioSchema)) { conteudo }: EdicaoComentario
  ) {
    return { comentario: await this.service.atualizar(ctx, id, conteudo) };
  }

  // Soft delete; cabe ao autor, owner ou admin (regra no service → 403).
  @Delete(":id")
  @HttpCode(200)
  async excluir(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    await this.service.excluir(ctx, id);
    return { ok: true };
  }
}
