import type { Request } from "express";
import { headersDaRequisicao, resolverTenantDaRequisicao, resolverUsuarioDaRequisicao } from "./ler-sessao";
import { resolverTenantContext, NaoAutenticadoError } from "@/lib/auth/resolver-tenant";
import { cookieDeSessao, usarSegredoDeTeste } from "../../../test/sessao";

jest.mock("@/lib/auth/resolver-tenant", () => ({
  ...jest.requireActual("@/lib/auth/resolver-tenant"),
  resolverTenantContext: jest.fn(),
}));

const resolver = resolverTenantContext as jest.Mock;

function req(headers: Record<string, string | string[] | undefined>) {
  return { headers } as unknown as Request;
}

usarSegredoDeTeste();

describe("headersDaRequisicao", () => {
  it("converte os headers do Express em Headers, preservando o cookie", () => {
    const h = headersDaRequisicao(req({ cookie: "crm_sessao=abc", "x-vazio": undefined }));
    expect(h.get("cookie")).toBe("crm_sessao=abc");
    expect(h.has("x-vazio")).toBe(false);
  });

  it("junta headers com múltiplos valores", () => {
    expect(headersDaRequisicao(req({ accept: ["a", "b"] })).get("accept")).toBe("a, b");
  });
});

describe("resolverTenantDaRequisicao", () => {
  afterEach(() => jest.clearAllMocks());

  it("passa sub e escritorioId do crm_sessao para o resolver compartilhado (role do banco)", async () => {
    resolver.mockResolvedValue({ usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" });

    const ctx = await resolverTenantDaRequisicao(
      req({ cookie: await cookieDeSessao({ sub: "user-1", escritorioId: "esc-1" }) })
    );

    expect(resolver).toHaveBeenCalledWith({ usuarioId: "user-1", escritorioId: "esc-1" });
    expect(ctx.role).toBe("padrao");
  });

  it("passa null sem cookie", async () => {
    resolver.mockRejectedValue(new NaoAutenticadoError());

    await expect(resolverTenantDaRequisicao(req({}))).rejects.toThrow(NaoAutenticadoError);
    expect(resolver).toHaveBeenCalledWith(null);
  });

  it("ignora o cookie do NextAuth (sessões antigas invalidadas)", async () => {
    resolver.mockRejectedValue(new NaoAutenticadoError());

    await expect(resolverTenantDaRequisicao(req({ cookie: "authjs.session-token=x" }))).rejects.toThrow(
      NaoAutenticadoError
    );
    expect(resolver).toHaveBeenCalledWith(null);
  });
});

describe("resolverUsuarioDaRequisicao", () => {
  it("devolve o sub do crm_sessao mesmo sem escritório ativo", async () => {
    const cookie = await cookieDeSessao({ sub: "user-1", escritorioId: null });

    await expect(resolverUsuarioDaRequisicao(req({ cookie }))).resolves.toBe("user-1");
  });

  it("lança NaoAutenticadoError sem cookie ou com cookie adulterado", async () => {
    await expect(resolverUsuarioDaRequisicao(req({}))).rejects.toThrow(NaoAutenticadoError);
    await expect(resolverUsuarioDaRequisicao(req({ cookie: "crm_sessao=a.b.c" }))).rejects.toThrow(
      NaoAutenticadoError
    );
  });
});
