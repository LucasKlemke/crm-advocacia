import type { Request, Response } from "express";
import {
  NOME_COOKIE_SESSAO_CRM,
  assinarSessao,
  extrairTokenDoCookie,
  opcoesCookieSessao,
  verificarSessao,
  type SessaoJwt,
} from "@/lib/auth/sessao-jwt";

// Ponte entre o módulo compartilhado (src/lib/auth/sessao-jwt.ts) e o Express. Só os
// controllers do SessaoModule gravam/limpam o cookie; os guards apenas leem.

export async function lerSessaoDaRequisicao(req: Request): Promise<SessaoJwt | null> {
  return verificarSessao(extrairTokenDoCookie(req.headers.cookie));
}

export async function gravarCookieSessao(res: Response, payload: SessaoJwt): Promise<void> {
  const token = await assinarSessao(payload);
  const { maxAge, ...opcoes } = opcoesCookieSessao();
  // O Express espera maxAge em milissegundos (o Next, em segundos).
  res.cookie(NOME_COOKIE_SESSAO_CRM, token, { ...opcoes, maxAge: maxAge * 1000 });
}

export function limparCookieSessao(res: Response): void {
  // clearCookie só apaga se path/sameSite/secure batem com os da gravação.
  const { maxAge: _maxAge, ...opcoes } = opcoesCookieSessao();
  res.clearCookie(NOME_COOKIE_SESSAO_CRM, opcoes);
}
