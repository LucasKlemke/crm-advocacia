import { SignJWT, jwtVerify } from "jose";

// Sessão própria do CRM (Fase 3 da migração — docs/arquitetura/migracao-nestjs.md).
// Este módulo é a única fonte de verdade de como o cookie é assinado e lido, e é usado
// pelos guards e controllers da API Nest (login/logout/sessão).
//
// O JWT só diz QUEM é o usuário e QUAL escritório está ativo. Papel e membership vêm
// sempre do banco (resolverTenantContext), nunca daqui (RN19).

export const NOME_COOKIE_SESSAO_CRM = "crm_sessao";
export const DURACAO_SESSAO_SEGUNDOS = 30 * 24 * 60 * 60;

export interface SessaoJwt {
  sub: string;
  escritorioId: string | null;
}

export interface OpcoesCookieSessao {
  httpOnly: boolean;
  sameSite: "lax";
  path: string;
  secure: boolean;
  // Em SEGUNDOS (convenção do JWT: exp/iat em segundos). O res.cookie do Express espera
  // milissegundos: a conversão fica em apps/api/src/comum/sessao/cookie-sessao.ts.
  maxAge: number;
}

const ALGORITMO = "HS256";

// AUTH_SECRET é o segredo atual; NEXTAUTH_SECRET fica como fallback documentado, para
// ambientes que ainda tenham só a variável antiga. Sem segredo é erro de configuração: lançar em vez de tratar como
// "deslogado" evita que um deploy quebrado pareça uma sessão expirada.
function chave(): Uint8Array {
  const segredo = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!segredo) {
    throw new Error("AUTH_SECRET não configurado.");
  }
  return new TextEncoder().encode(segredo);
}

export async function assinarSessao(payload: SessaoJwt): Promise<string> {
  // iat e exp calculados do mesmo instante: o JWT expira junto com o Max-Age do cookie.
  const agora = Math.floor(Date.now() / 1000);
  return new SignJWT({ escritorioId: payload.escritorioId })
    .setProtectedHeader({ alg: ALGORITMO })
    .setSubject(payload.sub)
    .setIssuedAt(agora)
    .setExpirationTime(agora + DURACAO_SESSAO_SEGUNDOS)
    .sign(chave());
}

export async function verificarSessao(
  token: string | null | undefined,
): Promise<SessaoJwt | null> {
  if (!token) return null;
  const segredo = chave();

  try {
    // `algorithms` fixo: impede downgrade para "none" ou para outro algoritmo.
    const { payload } = await jwtVerify(token, segredo, {
      algorithms: [ALGORITMO],
      // Sem exp um token vazado valeria para sempre; maxTokenAge limita pelo iat.
      requiredClaims: ["exp", "iat"],
      maxTokenAge: DURACAO_SESSAO_SEGUNDOS,
    });
    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      return null;
    }
    return {
      sub: payload.sub,
      escritorioId:
        typeof payload.escritorioId === "string" &&
        payload.escritorioId.length > 0
          ? payload.escritorioId
          : null,
    };
  } catch {
    // Assinatura inválida, expirado ou malformado: para quem chama, é só "sem sessão".
    return null;
  }
}

export function opcoesCookieSessao(): OpcoesCookieSessao {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: DURACAO_SESSAO_SEGUNDOS,
  };
}

// O Nest não usa cookie-parser: lê o header Cookie cru. Um JWT é base64url separado por
// pontos, então não há '=' nem caracteres que o Express codifique.
export function extrairTokenDoCookie(
  cabecalhoCookie: string | null | undefined,
): string | null {
  if (!cabecalhoCookie) return null;
  for (const parte of cabecalhoCookie.split(";")) {
    const separador = parte.indexOf("=");
    if (separador === -1) continue;
    if (parte.slice(0, separador).trim() === NOME_COOKIE_SESSAO_CRM) {
      return parte.slice(separador + 1).trim() || null;
    }
  }
  return null;
}
