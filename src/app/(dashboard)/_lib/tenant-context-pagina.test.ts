import { redirect } from "next/navigation";
import {
  getTenantContext,
  NaoAutenticadoError,
  SemEscritorioAtivoError,
  AcessoNegadoError,
} from "@/lib/auth/tenant-context";
import { getTenantContextOuRedirect } from "./tenant-context-pagina";

jest.mock("next/navigation", () => ({
  // O redirect() real interrompe a renderização lançando; o mock reproduz isso para o
  // teste distinguir "redirecionou" de "seguiu adiante".
  redirect: jest.fn((destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  }),
}));
// Mock completo: importar o módulo real puxaria NextAuth (ESM) e o Prisma para dentro do
// teste. As classes de erro abaixo são as mesmas instâncias que o helper enxerga, então
// os `instanceof` continuam válidos.
jest.mock("@/lib/auth/tenant-context", () => ({
  getTenantContext: jest.fn(),
  NaoAutenticadoError: class NaoAutenticadoError extends Error {},
  SemEscritorioAtivoError: class SemEscritorioAtivoError extends Error {},
  AcessoNegadoError: class AcessoNegadoError extends Error {},
}));

const mockedGetTenantContext = getTenantContext as jest.Mock;
const mockedRedirect = redirect as unknown as jest.Mock;

describe("getTenantContextOuRedirect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("devolve o contexto quando a sessão é válida", async () => {
    const ctx = { usuarioId: "u1", escritorioId: "e1", role: "owner" };
    mockedGetTenantContext.mockResolvedValue(ctx);

    await expect(getTenantContextOuRedirect()).resolves.toEqual(ctx);
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it("redireciona para /login sem sessão", async () => {
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    await expect(getTenantContextOuRedirect()).rejects.toThrow("REDIRECT:/login");
  });

  it("redireciona para /onboarding sem escritório ativo", async () => {
    mockedGetTenantContext.mockRejectedValue(new SemEscritorioAtivoError());

    await expect(getTenantContextOuRedirect()).rejects.toThrow("REDIRECT:/onboarding");
  });

  // Bug: membro removido do escritório com JWT ainda válido caía no `throw error` e via
  // uma página 500 em vez de voltar ao fluxo de escolher/criar escritório.
  it("redireciona para /onboarding quando o membro não pertence mais ao escritório", async () => {
    mockedGetTenantContext.mockRejectedValue(new AcessoNegadoError());

    await expect(getTenantContextOuRedirect()).rejects.toThrow("REDIRECT:/onboarding");
    expect(mockedRedirect).toHaveBeenCalledWith("/onboarding");
  });

  it("propaga erros inesperados", async () => {
    mockedGetTenantContext.mockRejectedValue(new Error("banco fora do ar"));

    await expect(getTenantContextOuRedirect()).rejects.toThrow("banco fora do ar");
    expect(mockedRedirect).not.toHaveBeenCalled();
  });
});
