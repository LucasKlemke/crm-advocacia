import { NextResponse, type NextRequest } from "next/server";
import { NOME_COOKIE_SESSAO_CRM, verificarSessao } from "@/lib/auth/sessao-jwt";

// RN01: qualquer página além de login/cadastro exige sessão válida (cookie crm_sessao
// assinado — o cookie legado do NextAuth não vale mais).
//
// O redirect só vale para navegação HTML. Rotas /api ficam FORA do matcher: elas são
// respondidas pela API Nest (rewrites em next.config.ts), cujos guards devolvem
// `{ error }` 401 por conta própria. Se o proxy as cobrisse, uma sessão expirada viraria
// um 307 para a página HTML de /login, e o apiFetch não conseguiria parsear a resposta.
export default async function proxy(req: NextRequest) {
  const sessao = await verificarSessao(req.cookies.get(NOME_COOKIE_SESSAO_CRM)?.value);
  if (sessao) return NextResponse.next();

  // Defesa em profundidade: se algum dia o matcher voltar a cobrir /api, a resposta
  // ainda é um 401 JSON — nunca um redirect HTML para um consumidor de API.
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.nextUrl.origin);
  loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // O `.*\..*` no fim exclui qualquer caminho com extensão de arquivo (ex.:
  // /images/foo.webp em public/) — arquivos estáticos nunca precisam de sessão,
  // e a tela de login/cadastro (não autenticada) depende de poder carregá-los.
  matcher: ["/((?!api/|login|cadastro|icon|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
