import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import {
  chaveMensagensCampanha,
  RAIZ_CAMPANHAS,
  useCampanha,
  useCampanhas,
  useControlarCampanha,
  useCriarCampanha,
  useMensagensCampanha,
  useSincronizarCampanha,
} from "./use-campanhas";

function criarWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return { queryClient, Wrapper };
}

const NOVA_CAMPANHA = {
  nome: "Retomada",
  instanciaId: "instancia-1",
  mensagemTemplate: "Olá {{nome}}",
  colunaNumero: "numero",
  mapeamentoVariaveis: { nome: { coluna: "Nome", tratamentos: [] } },
  delayMin: 3,
  delayMax: 6,
  linhas: [{ Nome: "Ana", numero: "5511999999999" }],
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      campanhas: [],
      campanha: { id: "campanha-1" },
      itens: [],
      total: 0,
      pagina: 1,
      porPagina: 50,
    }),
  } as unknown as Response);
});

describe("queries de campanha", () => {
  it("useCampanhas busca a listagem em /api/campanhas", async () => {
    const { Wrapper } = criarWrapper();
    const { result } = renderHook(() => useCampanhas(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith("/api/campanhas", expect.anything());
  });

  it("useCampanha leva a página pedida na query string", async () => {
    const { Wrapper } = criarWrapper();
    const { result } = renderHook(() => useCampanha("campanha-1", 3), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/campanhas/campanha-1?pagina=3",
      expect.anything()
    );
  });

  it("useMensagensCampanha busca o status da página pedida", async () => {
    const { Wrapper } = criarWrapper();
    const { result } = renderHook(() => useMensagensCampanha("campanha-1", 3), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/campanhas/campanha-1/mensagens?pagina=3",
      expect.anything()
    );
  });

  // Páginas diferentes trazem destinatários diferentes, então não podem compartilhar a
  // mesma entrada de cache — senão a página 2 mostraria o status casado da página 1.
  it("useMensagensCampanha guarda cada página numa entrada de cache própria", async () => {
    const { Wrapper } = criarWrapper();
    const { rerender } = renderHook(({ pagina }) => useMensagensCampanha("campanha-1", pagina), {
      wrapper: Wrapper,
      initialProps: { pagina: 1 },
    });

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    rerender({ pagina: 2 });

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect(global.fetch).toHaveBeenLastCalledWith(
      "/api/campanhas/campanha-1/mensagens?pagina=2",
      expect.anything()
    );
  });

  // O invalidate das mutations alcança a query pela raiz: é o que faz "Sincronizar"
  // atualizar o status sem uma segunda chamada ao /sender/listmessages.
  it("a chave das mensagens continua sob a raiz de campanhas", () => {
    expect(chaveMensagensCampanha("campanha-1", 2)[0]).toBe(RAIZ_CAMPANHAS[0]);
  });

  // A ordem pedida: banco primeiro, UAZAPI depois. Enquanto o detalhe não respondeu, a
  // consulta externa não sai.
  it("useMensagensCampanha não consulta nada enquanto está desabilitada", async () => {
    const { Wrapper } = criarWrapper();
    const { result } = renderHook(() => useMensagensCampanha("campanha-1", 1, false), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("mutations de campanha", () => {
  it("useCriarCampanha faz POST com as linhas do CSV e invalida a raiz", async () => {
    const { Wrapper, queryClient } = criarWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCriarCampanha(), { wrapper: Wrapper });

    result.current.mutate(NOVA_CAMPANHA);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/campanhas");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(NOVA_CAMPANHA);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: RAIZ_CAMPANHAS });
  });

  it("useSincronizarCampanha faz POST no id informado e invalida a raiz", async () => {
    const { Wrapper, queryClient } = criarWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useSincronizarCampanha(), { wrapper: Wrapper });

    result.current.mutate("campanha-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/campanhas/campanha-1/sincronizar");
    expect(init.method).toBe("POST");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: RAIZ_CAMPANHAS });
  });

  it("useControlarCampanha manda a ação no corpo e invalida a raiz", async () => {
    const { Wrapper, queryClient } = criarWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useControlarCampanha(), { wrapper: Wrapper });

    result.current.mutate({ id: "campanha-1", acao: "stop" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/campanhas/campanha-1/controlar");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ acao: "stop" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: RAIZ_CAMPANHAS });
  });
});
