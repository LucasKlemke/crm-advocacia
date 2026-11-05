/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import proxy from "./proxy";
import { assinarSessao } from "@/lib/auth/sessao-jwt";

function requisicao(caminho: string, cookie?: string) {
  return new NextRequest(`http://localhost:3000${caminho}`, { headers: cookie ? { cookie } : {} });
}

describe("proxy (RN01)", () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = "segredo-de-teste-com-pelo-menos-32-caracteres";
  });

  it("deixa passar com crm_sessao válido", async () => {
    const token = await assinarSessao({ sub: "user-1", escritorioId: "esc-1" });

    const res = await proxy(requisicao("/casos", `crm_sessao=${token}`));

    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("redireciona para /login com callbackUrl sem sessão", async () => {
    const res = await proxy(requisicao("/casos?aba=kanban"));

    expect(res.status).toBe(307);
    const destino = new URL(res.headers.get("location")!);
    expect(destino.pathname).toBe("/login");
    expect(destino.searchParams.get("callbackUrl")).toBe("/casos?aba=kanban");
  });

  it("redireciona com o cookie legado do NextAuth (sessões antigas invalidadas)", async () => {
    const res = await proxy(requisicao("/", "authjs.session-token=qualquer"));

    expect(res.status).toBe(307);
  });

  it("redireciona com crm_sessao adulterado", async () => {
    const res = await proxy(requisicao("/", "crm_sessao=a.b.c"));

    expect(res.status).toBe(307);
  });

  it("responde 401 JSON (nunca redirect HTML) se uma rota /api chegar aqui", async () => {
    const res = await proxy(requisicao("/api/clientes"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Sessão inválida ou expirada." });
  });
});
