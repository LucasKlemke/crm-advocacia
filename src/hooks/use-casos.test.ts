import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import {
  useAtualizarCaso,
  useArquivarCaso,
  useCasoFiltroOpcoes,
  useCasos,
  useCasosKanban,
  useCriarCaso,
} from "./use-casos";
import { filtrosCasosPadrao } from "@/types/caso";
import type { CasoDTO } from "@/types/caso";

function criarWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return { queryClient, Wrapper };
}

const CASO: CasoDTO = {
  id: "caso-1",
  escritorioId: "esc-1",
  clienteId: "cli-1",
  statusId: "status-1",
  responsavelMembroId: null,
  titulo: "Ação de cobrança",
  numeroProcesso: null,
  descricao: null,
  valor: null,
  arquivado: false,
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-01T12:00:00.000Z",
  cliente: {
    id: "cli-1",
    nome: "Maria Silva",
    cpf: "52998224725",
    email: null,
    telefone: null,
    endereco: null,
    softDeletedAt: null,
    createdAt: "2026-08-01T12:00:00.000Z",
    updatedAt: "2026-08-01T12:00:00.000Z",
  },
  status: {
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
  },
  responsavel: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

describe("useCasos", () => {
  it("busca a listagem em /api/casos com os filtros na query", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ casos: [CASO], total: 1, pagina: 1, porPagina: 20 }),
    } as Response);

    const { Wrapper } = criarWrapper();
    const { result } = renderHook(
      () => useCasos({ ...filtrosCasosPadrao, busca: "cobrança", statusIds: ["status-1"] }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.data?.total).toBe(1));
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("/api/casos?");
    expect(url).toContain("busca=cobran");
    expect(url).toContain("statusId=status-1");
  });

  it("sem filtros, busca /api/casos sem query string", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ casos: [], total: 0, pagina: 1, porPagina: 20 }),
    } as Response);

    const { Wrapper } = criarWrapper();
    renderHook(() => useCasos(filtrosCasosPadrao), { wrapper: Wrapper });

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/casos", expect.anything()));
  });
});

describe("useCasosKanban", () => {
  it("busca as colunas em /api/casos/kanban", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ colunas: [{ status: CASO.status, total: 1, casos: [CASO] }] }),
    } as Response);

    const { Wrapper } = criarWrapper();
    const { result } = renderHook(
      () => useCasosKanban({ ...filtrosCasosPadrao, busca: "cobrança" }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.data?.colunas).toHaveLength(1));
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("/api/casos/kanban?");
    expect(url).toContain("busca=cobran");
  });

  it("repassa statusId na query para ocultar colunas não selecionadas", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ colunas: [] }),
    } as Response);

    const { Wrapper } = criarWrapper();
    renderHook(() => useCasosKanban({ ...filtrosCasosPadrao, statusIds: ["status-1"] }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("statusId=status-1");
  });
});

describe("useCasoFiltroOpcoes", () => {
  it("busca as opções em /api/casos/filtros", async () => {
    const payload = { clientes: [], membros: [], status: [], tipos: [] };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payload,
    } as Response);

    const { Wrapper } = criarWrapper();
    const { result } = renderHook(() => useCasoFiltroOpcoes(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data).toEqual(payload));
    expect(global.fetch).toHaveBeenCalledWith("/api/casos/filtros", expect.anything());
  });
});

describe("useCriarCaso", () => {
  it("envia POST para /api/casos e invalida a raiz de casos", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ caso: CASO }),
    } as Response);

    const { Wrapper, queryClient } = criarWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCriarCaso(), { wrapper: Wrapper });

    result.current.mutate({ titulo: "Ação de cobrança", clienteId: "cli-1", statusId: "status-1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/casos");
    expect(init.method).toBe("POST");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["casos"] });
  });
});

describe("useAtualizarCaso", () => {
  it("envia PATCH para /api/casos/[id] (usado também na troca de status por drag-and-drop)", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ caso: CASO }),
    } as Response);

    const { Wrapper } = criarWrapper();
    const { result } = renderHook(() => useAtualizarCaso(), { wrapper: Wrapper });

    result.current.mutate({ id: "caso-1", dados: { statusId: "status-2" } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/casos/caso-1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ statusId: "status-2" });
  });
});

describe("useArquivarCaso", () => {
  it("envia DELETE para /api/casos/[id]", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ caso: { ...CASO, arquivado: true } }),
    } as Response);

    const { Wrapper } = criarWrapper();
    const { result } = renderHook(() => useArquivarCaso(), { wrapper: Wrapper });

    result.current.mutate("caso-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/casos/caso-1");
    expect(init.method).toBe("DELETE");
  });
});
