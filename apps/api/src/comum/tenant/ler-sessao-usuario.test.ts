import type { Request } from "express";
import { resolverUsuarioDaRequisicao } from "./ler-sessao";
import { lerTokenDaSessao } from "@/lib/auth/token";
import { NaoAutenticadoError } from "@/lib/auth/resolver-tenant";

jest.mock("@/lib/auth/token", () => ({ lerTokenDaSessao: jest.fn() }));

const lerToken = lerTokenDaSessao as jest.Mock;

function req(headers: Record<string, string>) {
  return { headers } as unknown as Request;
}

describe("resolverUsuarioDaRequisicao", () => {
  afterEach(() => jest.clearAllMocks());

  it("devolve o sub do JWT, lendo o cookie da requisição", async () => {
    lerToken.mockResolvedValue({ sub: "user-1", escritorioId: "esc-1" });

    await expect(resolverUsuarioDaRequisicao(req({ cookie: "authjs.session-token=abc" }))).resolves.toBe("user-1");

    const [{ headers }] = lerToken.mock.calls[0];
    expect((headers as Headers).get("cookie")).toBe("authjs.session-token=abc");
  });

  it("não exige escritório ativo (onboarding)", async () => {
    lerToken.mockResolvedValue({ sub: "user-1", escritorioId: null });

    await expect(resolverUsuarioDaRequisicao(req({}))).resolves.toBe("user-1");
  });

  it("lança NaoAutenticadoError sem token", async () => {
    lerToken.mockResolvedValue(null);

    await expect(resolverUsuarioDaRequisicao(req({}))).rejects.toThrow(NaoAutenticadoError);
  });

  it("lança NaoAutenticadoError com token sem sub", async () => {
    lerToken.mockResolvedValue({ escritorioId: "esc-1" });

    await expect(resolverUsuarioDaRequisicao(req({}))).rejects.toThrow(NaoAutenticadoError);
  });
});
