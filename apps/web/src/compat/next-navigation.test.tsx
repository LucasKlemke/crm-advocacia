import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { criarQueryClientDeTeste } from "@/lib/test-utils";
import { queryClientRaiz } from "@/lib/query/query-client-raiz";
import { useParams, usePathname, useRouter, useSearchParams } from "./next-navigation";

function montar(rota: string, padrao = "*") {
  const queryClient = criarQueryClientDeTeste();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[rota]}>
          <Routes>
            <Route path={padrao} element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  const hook = renderHook(
    () => ({
      router: useRouter(),
      pathname: usePathname(),
      searchParams: useSearchParams(),
      params: useParams(),
    }),
    { wrapper: Wrapper }
  );
  return { queryClient, ...hook };
}

describe("compat de next/navigation", () => {
  it("usePathname e useSearchParams leem a URL atual", () => {
    const { result } = montar("/agenda?visao=semana&data=2026-09-10");

    expect(result.current.pathname).toBe("/agenda");
    expect(result.current.searchParams.get("visao")).toBe("semana");
    expect(result.current.searchParams.get("data")).toBe("2026-09-10");
  });

  it("useParams expõe os segmentos dinâmicos da rota", () => {
    const { result } = montar("/campanhas/abc123", "/campanhas/:id");

    expect(result.current.params).toEqual({ id: "abc123" });
  });

  it("push empilha no histórico e back volta para a entrada anterior", () => {
    const { result } = montar("/clientes");

    act(() => result.current.router.push("/casos"));
    act(() => result.current.router.push("/agenda"));
    expect(result.current.pathname).toBe("/agenda");

    act(() => result.current.router.back());
    expect(result.current.pathname).toBe("/casos");
  });

  it("replace troca a entrada atual sem empilhar (aceita { scroll: false } como no Next)", () => {
    const { result } = montar("/clientes");

    act(() => result.current.router.push("/agenda?visao=mes"));
    act(() => result.current.router.replace("/agenda?visao=semana", { scroll: false }));
    expect(result.current.searchParams.get("visao")).toBe("semana");

    act(() => result.current.router.back());
    expect(result.current.pathname).toBe("/clientes");
  });

  // No Next, refresh() relia os Server Components — dados do tenant e sessão. Aqui o
  // equivalente é invalidar o cache do tenant e a sessão (ex.: após trocar de escritório).
  it("refresh invalida o cache do tenant e a sessão", () => {
    const { result, queryClient } = montar("/configuracoes/escritorio");
    const invalidarTenant = jest.spyOn(queryClient, "invalidateQueries");
    const invalidarRaiz = jest.spyOn(queryClientRaiz, "invalidateQueries");

    act(() => result.current.router.refresh());

    expect(invalidarTenant).toHaveBeenCalledWith();
    expect(invalidarRaiz).toHaveBeenCalledWith({ queryKey: ["sessao"] });
    invalidarRaiz.mockRestore();
  });
});
