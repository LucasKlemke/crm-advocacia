import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import {
  useStatus,
  useTiposStatus,
  useCriarStatus,
  useAtualizarStatus,
  useExcluirStatus,
} from "./use-status";
import type { StatusDTO, TipoStatusDTO } from "@/types/status";

function criarWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return { queryClient, Wrapper };
}

const STATUS: StatusDTO = {
  id: "status-1",
  escritorioId: "esc-1",
  tipoStatusId: "tipo-1",
  nome: "Em análise",
  icone: "Search",
  cor: "#f59e0b",
  descricao: null,
  ordem: 1,
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-01T12:00:00.000Z",
};

const TIPO: TipoStatusDTO = {
  id: "tipo-1",
  chave: "negociacao",
  nome: "Em análise",
  icone: "Search",
  cor: "#f59e0b",
  descricao: null,
  ordem: 2,
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

describe("useStatus", () => {
  it("busca a lista de status em /api/status", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: [STATUS] }),
    } as Response);

    const { Wrapper } = criarWrapper();
    const { result } = renderHook(() => useStatus(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data).toEqual({ status: [STATUS] }));
    expect(global.fetch).toHaveBeenCalledWith("/api/status", expect.anything());
  });
});

describe("useTiposStatus", () => {
  it("busca a lista de tipos de status em /api/tipos-status", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ tipos: [TIPO] }),
    } as Response);

    const { Wrapper } = criarWrapper();
    const { result } = renderHook(() => useTiposStatus(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data).toEqual({ tipos: [TIPO] }));
    expect(global.fetch).toHaveBeenCalledWith("/api/tipos-status", expect.anything());
  });
});

describe("useCriarStatus", () => {
  it("envia POST para /api/status e invalida a listagem", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ status: STATUS }),
    } as Response);

    const { Wrapper, queryClient } = criarWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCriarStatus(), { wrapper: Wrapper });

    result.current.mutate({
      nome: "Em análise",
      tipoStatusId: "tipo-1",
      icone: "Search",
      cor: "#f59e0b",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/status");
    expect(init.method).toBe("POST");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["status"] });
  });
});

describe("useAtualizarStatus", () => {
  it("envia PATCH para /api/status/[id]", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: STATUS }),
    } as Response);

    const { Wrapper } = criarWrapper();
    const { result } = renderHook(() => useAtualizarStatus(), { wrapper: Wrapper });

    result.current.mutate({ id: "status-1", dados: { nome: "Novo nome" } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/status/status-1");
    expect(init.method).toBe("PATCH");
  });
});

describe("useExcluirStatus", () => {
  it("envia DELETE para /api/status/[id]", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as Response);

    const { Wrapper } = criarWrapper();
    const { result } = renderHook(() => useExcluirStatus(), { wrapper: Wrapper });

    result.current.mutate("status-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/status/status-1");
    expect(init.method).toBe("DELETE");
  });
});
