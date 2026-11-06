import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Todo componente que usa hooks de dados precisa de um QueryClient. Aqui ele nasce
// isolado por teste e sem retry, para que uma falha simulada apareça de imediato em
// vez de ficar em nova tentativa até o timeout do Jest.
export function criarQueryClientDeTeste() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderComQuery(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  const queryClient = criarQueryClientDeTeste();

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}

export * from "@testing-library/react";
