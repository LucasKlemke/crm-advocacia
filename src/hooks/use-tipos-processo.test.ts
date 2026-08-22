import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import {
  chaveTiposProcesso,
  useTiposProcesso,
  useCriarTipoProcesso,
  useAtualizarTipoProcesso,
  useExcluirTipoProcesso,
} from "./use-tipos-processo";
import { chaveCasosFiltroOpcoes } from "@/lib/query/chaves";

function criarWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return { queryClient, Wrapper };
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ tipos: [], tipo: { id: "tipo-processo-1" }, ok: true }),
  } as unknown as Response);
});

describe("useTiposProcesso", () => {
  it("busca a listagem em /api/tipos-processo", async () => {
    const { Wrapper } = criarWrapper();
    const { result } = renderHook(() => useTiposProcesso(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith("/api/tipos-processo", expect.anything());
  });
});

describe("mutations de tipo de processo", () => {
  it("useCriarTipoProcesso faz POST e invalida a lista e as opções de filtro", async () => {
    const { Wrapper, queryClient } = criarWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCriarTipoProcesso(), { wrapper: Wrapper });

    result.current.mutate({ nome: "Juros abusivos", icone: "Briefcase", cor: "#6366f1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/tipos-processo");
    expect(init.method).toBe("POST");
    // O mesmo tipo alimenta o select do formulário de processo e o filtro do header.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: chaveTiposProcesso() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: chaveCasosFiltroOpcoes() });
  });

  it("useAtualizarTipoProcesso faz PATCH no id informado", async () => {
    const { Wrapper } = criarWrapper();
    const { result } = renderHook(() => useAtualizarTipoProcesso(), { wrapper: Wrapper });

    result.current.mutate({ id: "tipo-processo-1", dados: { nome: "Revisional" } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/tipos-processo/tipo-processo-1");
    expect(init.method).toBe("PATCH");
  });

  it("useExcluirTipoProcesso faz DELETE no id informado", async () => {
    const { Wrapper } = criarWrapper();
    const { result } = renderHook(() => useExcluirTipoProcesso(), { wrapper: Wrapper });

    result.current.mutate("tipo-processo-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/tipos-processo/tipo-processo-1");
    expect(init.method).toBe("DELETE");
  });
});
