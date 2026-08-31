import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import {
  chaveInstanciasWhatsapp,
  useInstanciasWhatsapp,
  useCriarInstanciaWhatsapp,
  useReconectarInstanciaWhatsapp,
  useVerificarStatusInstanciaWhatsapp,
  useSincronizarInstanciasWhatsapp,
} from "./use-instancias-whatsapp";

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
    json: async () => ({
      instancias: [],
      instancia: { id: "instancia-1", status: "connecting" },
      qrcode: "data:image/png;base64,abc",
      paircode: "1234",
    }),
  } as unknown as Response);
});

describe("useInstanciasWhatsapp", () => {
  it("busca a listagem em /api/instancias", async () => {
    const { Wrapper } = criarWrapper();
    const { result } = renderHook(() => useInstanciasWhatsapp(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith("/api/instancias", expect.anything());
  });
});

describe("mutations de instância de WhatsApp", () => {
  it("useCriarInstanciaWhatsapp faz POST e invalida a lista", async () => {
    const { Wrapper, queryClient } = criarWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCriarInstanciaWhatsapp(), { wrapper: Wrapper });

    result.current.mutate({ nome: "Atendimento" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/instancias");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ nome: "Atendimento" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: chaveInstanciasWhatsapp() });
  });

  it("useReconectarInstanciaWhatsapp faz POST no id informado e invalida a lista", async () => {
    const { Wrapper, queryClient } = criarWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useReconectarInstanciaWhatsapp(), { wrapper: Wrapper });

    result.current.mutate("instancia-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/instancias/instancia-1/reconectar");
    expect(init.method).toBe("POST");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: chaveInstanciasWhatsapp() });
  });

  it("useVerificarStatusInstanciaWhatsapp faz GET no id informado e invalida a lista", async () => {
    const { Wrapper, queryClient } = criarWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useVerificarStatusInstanciaWhatsapp(), {
      wrapper: Wrapper,
    });

    result.current.mutate("instancia-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/instancias/instancia-1/status");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: chaveInstanciasWhatsapp() });
  });

  it("useSincronizarInstanciasWhatsapp faz POST em /api/instancias/sincronizar e invalida a lista", async () => {
    const { Wrapper, queryClient } = criarWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useSincronizarInstanciasWhatsapp(), {
      wrapper: Wrapper,
    });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/instancias/sincronizar");
    expect(init.method).toBe("POST");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: chaveInstanciasWhatsapp() });
  });
});
