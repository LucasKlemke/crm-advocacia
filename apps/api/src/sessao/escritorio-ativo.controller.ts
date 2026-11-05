import { Body, Controller, HttpCode, Inject, Post, Res, UseFilters, UseGuards } from "@nestjs/common";
// Alias: `Response` sem prefixo é o global do fetch, usado pelo tradutor de erro.
import type { Response as ExpressResponse } from "express";
import { ErrosHttpFilter, type TradutorDeErro } from "../comum/erros-http.filter";
import { ValidacaoZodPipe } from "../comum/validacao.pipe";
import { gravarCookieSessao } from "../comum/sessao/cookie-sessao";
import { UsuarioGuard } from "../comum/tenant/usuario.guard";
import { UsuarioId } from "../comum/tenant/usuario.decorator";
import { MEMBRO_SERVICE } from "./tokens";
import { trocarEscritorioSchema, type DadosTrocaEscritorio } from "./schemas";
import { PermissaoNegadaError, type membroService } from "@/services/membro.service";

const tratarErroDeTroca: TradutorDeErro = (error) =>
  error instanceof PermissaoNegadaError ? Response.json({ error: error.message }, { status: 403 }) : null;

// Só troca para um escritório onde o usuário é membro — o escritorioId do corpo nunca é
// gravado sem passar por trocarEscritorioAtivo, que consulta o banco (RN19).
@Controller("sessao")
@UseGuards(UsuarioGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeTroca]))
export class EscritorioAtivoController {
  constructor(@Inject(MEMBRO_SERVICE) private readonly membros: Pick<typeof membroService, "trocarEscritorioAtivo">) {}

  @Post("escritorio-ativo")
  @HttpCode(200)
  async trocar(
    @UsuarioId() usuarioId: string,
    @Body(new ValidacaoZodPipe(trocarEscritorioSchema)) dados: DadosTrocaEscritorio,
    @Res({ passthrough: true }) res: ExpressResponse
  ) {
    const membro = await this.membros.trocarEscritorioAtivo(usuarioId, dados.escritorioId);
    await gravarCookieSessao(res, { sub: usuarioId, escritorioId: membro.escritorioId });
    return { escritorioId: membro.escritorioId, role: membro.role };
  }
}
