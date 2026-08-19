import { getToken } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";

// Sob HTTPS o Auth.js grava a sessão com o prefixo `__Secure-` (e usa esse mesmo nome
// como salt da criptografia do JWT). `getToken()` sem `secureCookie` procura sempre o
// nome sem prefixo: em produção o cookie existe, mas nunca é encontrado, e toda rota
// que lê o token responde 401. Este módulo centraliza essa detecção — nenhuma rota deve
// chamar `getToken()` diretamente.
export const NOME_COOKIE_SESSAO = "authjs.session-token";
export const NOME_COOKIE_SESSAO_SEGURO = `__Secure-${NOME_COOKIE_SESSAO}`;

// Cookies chunkados ganham sufixo `.0`, `.1`, ... (SessionStore do Auth.js).
const REGEX_COOKIE_SEGURO = new RegExp(
  `(?:^|;\\s*)__Secure-authjs\\.session-token(?:\\.\\d+)?=`
);
const REGEX_COOKIE_SIMPLES = new RegExp(`(?:^|;\\s*)authjs\\.session-token(?:\\.\\d+)?=`);

export interface RequestComHeaders {
  headers: Headers;
}

// A evidência mais confiável é o cookie que o browser realmente mandou (funciona mesmo
// atrás de proxy/load balancer, onde o protocolo interno da request é http). Sem cookie
// de sessão, cai para a URL pública configurada e, por fim, para o NODE_ENV — a mesma
// ordem que o Auth.js usa para decidir o prefixo na hora de gravar.
export function deveUsarCookieSeguro(request?: RequestComHeaders): boolean {
  const cookies = request?.headers?.get("cookie") ?? "";

  if (REGEX_COOKIE_SEGURO.test(cookies)) {
    return true;
  }
  if (REGEX_COOKIE_SIMPLES.test(cookies)) {
    return false;
  }

  const url = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (url) {
    return url.startsWith("https://");
  }

  return process.env.NODE_ENV === "production";
}

function obterSecret(): string | undefined {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
}

// Leitura pura do JWT da sessão (não reemite Set-Cookie, ao contrário de `auth()`).
// Usada nas rotas que precisam emitir o próprio Set-Cookie via `unstable_update()`.
export async function lerTokenDaSessao(request: RequestComHeaders): Promise<JWT | null> {
  return getToken({
    req: request,
    secret: obterSecret(),
    secureCookie: deveUsarCookieSeguro(request),
  });
}

// Atalho para o caso mais comum: só o id do usuário autenticado, ou null.
export async function lerUsuarioIdDaSessao(
  request: RequestComHeaders
): Promise<string | null> {
  const token = await lerTokenDaSessao(request);
  return token?.sub ?? null;
}
