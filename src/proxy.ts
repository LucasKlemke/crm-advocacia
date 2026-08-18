import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";

// RN01: qualquer recurso além de login/cadastro exige sessão válida.
export default auth((req) => {
  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  matcher: [
    "/((?!api/auth|api/escritorios|login|cadastro|_next/static|_next/image|favicon.ico).*)",
  ],
};
