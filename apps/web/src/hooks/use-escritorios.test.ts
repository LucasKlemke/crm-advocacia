import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { criarQueryClientDeTeste } from "@/lib/test-utils";
import { mockApi } from "@/lib/test-paginas";
import { useEscritorioAtual, useMeusEscritorios } from "./use-escritorios";

function wrapper() {
  const queryClient = criarQueryClientDeTeste();
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useMeusEscritorios", () => {
  it("lê a lista de GET /api/escritorios", async () => {
    mockApi({ "/api/escritorios": { escritorios: [{ id: "esc-1", nome: "Um", role: "owner" }] } });
    const { result } = renderHook(() => useMeusEscritorios(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "esc-1", nome: "Um", role: "owner" }]);
  });
});

describe("useEscritorioAtual", () => {
  it("lê o escritório ativo de GET /api/escritorios/atual", async () => {
    const escritorio = { id: "esc-1", nome: "Um", oabResponsavel: null, telefoneWhatsapp: null };
    mockApi({ "/api/escritorios/atual": { escritorio } });
    const { result } = renderHook(() => useEscritorioAtual(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(escritorio);
  });

  it("expõe o erro da API", async () => {
    mockApi({ "/api/escritorios/atual": new Error("Escritório não encontrado.") });
    const { result } = renderHook(() => useEscritorioAtual(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Escritório não encontrado.");
  });
});
