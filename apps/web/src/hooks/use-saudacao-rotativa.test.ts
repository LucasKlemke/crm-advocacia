import { renderHook } from "@testing-library/react";
import {
  SAUDACOES,
  SUBTITULOS,
  useSaudacaoRotativa,
} from "./use-saudacao-rotativa";

const CHAVE_STORAGE = "dashboard-saudacao-rotativa";
const SEIS_HORAS_MS = 6 * 60 * 60 * 1000;

describe("useSaudacaoRotativa", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("retorna uma saudação e um subtítulo válidos", () => {
    const { result } = renderHook(() => useSaudacaoRotativa());

    expect(SAUDACOES).toContain(result.current.saudacao);
    expect(SUBTITULOS).toContain(result.current.subtitulo);
  });

  it("persiste o par sorteado no localStorage", () => {
    renderHook(() => useSaudacaoRotativa());

    const armazenado = window.localStorage.getItem(CHAVE_STORAGE);
    expect(armazenado).not.toBeNull();
  });

  it("mantém o mesmo par dentro da janela de 6 horas", () => {
    const primeira = renderHook(() => useSaudacaoRotativa());
    const parInicial = primeira.result.current;

    const segunda = renderHook(() => useSaudacaoRotativa());

    expect(segunda.result.current).toEqual(parInicial);
  });

  it("sorteia um novo par após 6 horas", () => {
    window.localStorage.setItem(
      CHAVE_STORAGE,
      JSON.stringify({
        saudacaoIndice: 0,
        subtituloIndice: 0,
        sorteadoEm: Date.now() - SEIS_HORAS_MS - 1000,
      })
    );

    renderHook(() => useSaudacaoRotativa());

    const armazenado = JSON.parse(window.localStorage.getItem(CHAVE_STORAGE) as string);
    expect(Date.now() - armazenado.sorteadoEm).toBeLessThan(1000);
  });
});
