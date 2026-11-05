import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ValidacaoZodPipe } from "../comum/validacao.pipe";
import { gravarCookieSessao, lerSessaoDaRequisicao, limparCookieSessao } from "../comum/sessao/cookie-sessao";
import { AUTORIZAR_CREDENCIAIS, MEMBRO_SERVICE, USUARIO_SERVICE } from "./tokens";
import { loginSchema, type DadosLogin } from "./schemas";
import { NaoAutenticadoError } from "@dominio/lib/auth/resolver-tenant";
import type { authorizeCredentials } from "@dominio/lib/auth/authorize";
import type { usuarioService } from "@dominio/services/usuario.service";
import type { membroService } from "@dominio/services/membro.service";

// Substitui o NextAuth (Fase 3). Rotas públicas: não usam TenantGuard/UsuarioGuard —
// login cria a sessão, logout funciona sem ela e /sessao responde 401 por conta própria.
@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AUTORIZAR_CREDENCIAIS) private readonly autorizar: typeof authorizeCredentials,
    @Inject(USUARIO_SERVICE) private readonly usuarios: Pick<typeof usuarioService, "obterPerfil">,
    @Inject(MEMBRO_SERVICE) private readonly membros: Pick<typeof membroService, "obterMembroDoUsuario">
  ) {}

  // authorizeCredentials já recusa usuário inativo (RN02a) e escolhe o escritório inicial
  // via resolverEscritorioAtivo (membership ativa mais antiga).
  @Post("login")
  @HttpCode(200)
  async login(
    @Body(new ValidacaoZodPipe(loginSchema)) dados: DadosLogin,
    @Res({ passthrough: true }) res: Response
  ) {
    const usuario = await this.autorizar(dados.email, dados.senha);
    if (!usuario) {
      throw new UnauthorizedException("E-mail ou senha inválidos.");
    }

    await gravarCookieSessao(res, { sub: usuario.id, escritorioId: usuario.escritorioId });

    return {
      usuario: { id: usuario.id, nome: usuario.name, email: usuario.email },
      escritorioId: usuario.escritorioId,
    };
  }

  @Post("logout")
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    limparCookieSessao(res);
    return { ok: true };
  }

  @Get("sessao")
  async sessao(@Req() req: Request) {
    const sessao = await lerSessaoDaRequisicao(req);
    if (!sessao) {
      throw new NaoAutenticadoError();
    }

    const usuario = await this.usuarios.obterPerfil(sessao.sub);
    if (!usuario || !usuario.ativo) {
      throw new NaoAutenticadoError();
    }

    // role sempre do banco (RN19); escritório sem membership nunca é devolvido.
    const membro = sessao.escritorioId
      ? await this.membros.obterMembroDoUsuario(sessao.sub, sessao.escritorioId)
      : null;

    return {
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
      escritorioId: membro ? sessao.escritorioId : null,
      role: membro?.role ?? null,
    };
  }
}
