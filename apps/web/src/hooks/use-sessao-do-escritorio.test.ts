import { renderHook } from "@testing-library/react";
import { chaveSessao } from "@/lib/query/chaves";
import { queryClientRaiz } from "@/lib/query/query-client-raiz";
import { SESSAO_OWNER } from "@/lib/test-paginas";
import { useSessaoDoEscritorio } from "./use-sessao-do-escritorio";

// useSessao lê do queryClientRaiz (não de contexto): a sessão é preparada ali.
afterEach(() => queryClientRaiz.clear());

describe("useSessaoDoEscritorio", () => {
  it("devolve a sessão com escritório e papel garantidos", () => {
    queryClientRaiz.setQueryData(chaveSessao(), SESSAO_OWNER);
    const { result } = renderHook(() => useSessaoDoEscritorio());
    expect(result.current).toEqual(SESSAO_OWNER);
  });

  it("falha alto fora de uma rota com escritório ativo", () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    queryClientRaiz.setQueryData(chaveSessao(), { ...SESSAO_OWNER, escritorioId: null, role: null });
    expect(() => renderHook(() => useSessaoDoEscritorio())).toThrow(/RotaProtegida/);
  });

  it("falha alto sem sessão carregada", () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    queryClientRaiz.setQueryData(chaveSessao(), null);
    expect(() => renderHook(() => useSessaoDoEscritorio())).toThrow(/RotaProtegida/);
  });
});
