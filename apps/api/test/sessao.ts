import { NOME_COOKIE_SESSAO_CRM, assinarSessao, type SessaoJwt } from "@/lib/auth/sessao-jwt";

// Os testes de sessão usam JWT de verdade (assinado com este segredo) em vez de mockar
// o jose: assim o teste cobre o caminho real do cookie até o controller.
export const SEGREDO_DE_TESTE = "segredo-de-teste-com-pelo-menos-32-caracteres";

export function usarSegredoDeTeste(): void {
  const anterior = process.env.AUTH_SECRET;
  beforeAll(() => {
    process.env.AUTH_SECRET = SEGREDO_DE_TESTE;
  });
  afterAll(() => {
    if (anterior === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = anterior;
  });
}

export async function cookieDeSessao(payload: SessaoJwt): Promise<string> {
  return `${NOME_COOKIE_SESSAO_CRM}=${await assinarSessao(payload)}`;
}

export function setCookieDaSessao(res: { headers: Record<string, unknown> }): string | undefined {
  const valores = ([] as string[]).concat((res.headers["set-cookie"] as string[] | string | undefined) ?? []);
  return valores.find((cookie) => cookie.startsWith(`${NOME_COOKIE_SESSAO_CRM}=`));
}

export function tokenDoSetCookie(setCookie: string | undefined): string | null {
  if (!setCookie) return null;
  const valor = setCookie.split(";")[0].slice(NOME_COOKIE_SESSAO_CRM.length + 1);
  return valor || null;
}
