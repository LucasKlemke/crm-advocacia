"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { opcoesPadraoQuery } from "@/lib/query/opcoes-padrao";

function criarQueryClient() {
  return new QueryClient({ defaultOptions: { queries: opcoesPadraoQuery } });
}

export interface QueryProviderProps {
  children: ReactNode;
  /** Tenant dono do cache. Ao trocar de escritório, o cache inteiro é descartado. */
  escritorioId?: string;
}

// O QueryClient nasce dentro do useState para não ser compartilhado entre requisições
// no server nem recriado a cada render — cada aba do navegador tem o seu cache.
// Como todo dado em cache é escopado ao escritório da sessão, trocar de tenant exige
// um client novo: reaproveitar o anterior mostraria os registros do escritório antigo.
export function QueryProvider({ children, escritorioId }: QueryProviderProps) {
  const [estado, setEstado] = useState(() => ({
    queryClient: criarQueryClient(),
    escritorioId,
  }));

  if (estado.escritorioId !== escritorioId) {
    setEstado({ queryClient: criarQueryClient(), escritorioId });
  }

  // A key remonta a árvore junto com o client novo: os observers do React Query nascem
  // presos ao client do mount e não migrariam sozinhos para o cache do novo escritório.
  return (
    <QueryClientProvider key={estado.escritorioId} client={estado.queryClient}>
      {children}
    </QueryClientProvider>
  );
}
