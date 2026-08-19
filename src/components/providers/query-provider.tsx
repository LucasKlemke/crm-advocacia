"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ehSessaoExpirada } from "@/lib/api-client";

// O QueryClient nasce dentro do useState para não ser compartilhado entre requisições
// no server nem recriado a cada render — cada aba do navegador tem o seu cache.
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // Sessão expirada não se resolve tentando de novo (o apiFetch já leva o
            // usuário ao login): repetir só atrasaria o erro aparecer na tela.
            retry: (falhas, erro) => !ehSessaoExpirada(erro) && falhas < 1,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
