import type { Request } from "express";
import { headersDaRequisicao, resolverTenantDaRequisicao } from "./ler-sessao";
import { lerTokenDaSessao } from "@/lib/auth/token";
import { resolverTenantContext } from "@/lib/auth/resolver-tenant";

jest.mock("@/lib/auth/token", () => ({ lerTokenDaSessao: jest.fn() }));
jest.mock("@/lib/auth/resolver-tenant", () => ({ resolverTenantContext: jest.fn() }));

const lerToken = lerTokenDaSessao as jest.Mock;
const resolver = resolverTenantContext as jest.Mock;

function req(headers: Record<string, string | string[] | undefined>) {
  return { headers } as unknown as Request;
}

describe("headersDaRequisicao", () => {
  it("converte os headers do Express em Headers, preservando o cookie", () => {
    const h = headersDaRequisicao(req({ cookie: "authjs.session-token=abc", "x-vazio": undefined }));
    expect(h.get("cookie")).toBe("authjs.session-token=abc");
    expect(h.has("x-vazio")).toBe(false);
  });

  it("junta headers com múltiplos valores", () => {
    const h = headersDaRequisicao(req({ accept: ["a", "b"] }));
    expect(h.get("accept")).toBe("a, b");
  });
});

describe("resolverTenantDaRequisicao", () => {
  afterEach(() => jest.clearAllMocks());

  it("passa sub e escritorioId do JWT para o resolver compartilhado", async () => {
    lerToken.mockResolvedValue({ sub: "user-1", escritorioId: "esc-1", role: "owner" });
    resolver.mockResolvedValue({ usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" });

    const ctx = await resolverTenantDaRequisicao(req({ cookie: "x=1" }));

    expect(resolver).toHaveBeenCalledWith({ usuarioId: "user-1", escritorioId: "esc-1" });
    expect(ctx.role).toBe("padrao");
  });

  it("passa null quando não há token", async () => {
    lerToken.mockResolvedValue(null);
    resolver.mockRejectedValue(new Error("sem sessão"));

    await expect(resolverTenantDaRequisicao(req({}))).rejects.toThrow("sem sessão");
    expect(resolver).toHaveBeenCalledWith(null);
  });
});
