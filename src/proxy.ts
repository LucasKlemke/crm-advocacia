import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";

// RN01: qualquer página além de login/cadastro exige sessão válida.
//
// O redirect só vale para navegação HTML. Rotas /api ficam FORA do matcher: elas já
// autenticam por conta própria (getTenantContext() → NaoAutenticadoError → 401 JSON via
// tratarErroDeContexto(), ou auth()/getToken() nas rotas fora de tenant) e devolvem
// `{ error }` com o status certo. Se o middleware as cobrisse, uma sessão expirada
// viraria um 307 para a página HTML de /login — o fetch seguiria o redirect, o
// apiFetch não conseguiria parsear o HTML e a UI mostraria "lista vazia" em vez de
// mandar o usuário ao login.
export default auth((req) => {
  if (req.auth) return;

  // Defesa em profundidade: se algum dia o matcher voltar a cobrir /api, a resposta
  // ainda é um 401 JSON — nunca um redirect HTML para um consumidor de API.
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.nextUrl.origin);
  loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: ["/((?!api/|login|cadastro|icon|_next/static|_next/image|favicon.ico).*)"],
};
