import { Body, Controller, Inject, Post, Res, UseGuards } from "@nestjs/common";
import type { Response as ExpressResponse } from "express";
import { ValidacaoZodPipe } from "../comum/validacao.pipe";
import { gravarCookieSessao } from "../comum/sessao/cookie-sessao";
import { UsuarioGuard } from "../comum/tenant/usuario.guard";
import { UsuarioId } from "../comum/tenant/usuario.decorator";
import { ESCRITORIO_SERVICE } from "./tokens";
import { criarEscritorioSchema } from "@dominio/lib/api/schemas-escritorio";
import type { CriarEscritorioInput, escritorioService } from "@dominio/services/escritorio.service";

// POST /api/escritorios (raiz): onboarding do primeiro escritório ou criação de outro pelo
// switcher. Exige só usuário autenticado — não passa por TenantGuard, porque o usuário
// pode ainda não ter escritório. GET/PATCH /api/escritorios/atual seguem no módulo de
// escritórios da Fase 2; os dois controllers dividem o prefixo sem conflito de rota.
@Controller("escritorios")
@UseGuards(UsuarioGuard)
export class CriarEscritorioController {
  constructor(
    @Inject(ESCRITORIO_SERVICE) private readonly escritorios: Pick<typeof escritorioService, "criarEscritorio">
  ) {}

  @Post()
  async criar(
    @UsuarioId() usuarioId: string,
    @Body(new ValidacaoZodPipe(criarEscritorioSchema)) dados: CriarEscritorioInput,
    @Res({ passthrough: true }) res: ExpressResponse
  ) {
    const { escritorio, membro } = await this.escritorios.criarEscritorio(usuarioId, dados);
    // Escritório recém-criado vira o ativo da sessão.
    await gravarCookieSessao(res, { sub: usuarioId, escritorioId: escritorio.id });
    return { escritorio: { id: escritorio.id, nome: escritorio.nome }, role: membro.role };
  }
}
