import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { Toaster } from "@/components/ui/sonner";
import { queryClientRaiz } from "@/lib/query/query-client-raiz";
import { rotas } from "@/rotas";

// Providers globais. O tema é fixo em light: o app nunca ofereceu modo escuro, então
// a página é sempre clara (next-themes só cuida da classe .dark).
// O cache dos dados do escritório não mora aqui: a RotaProtegida monta um QueryProvider
// por tenant; este client guarda só a sessão e as telas públicas. Toaster é global.
export function Provedores({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={queryClientRaiz}>
        {children}
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export function App() {
  // Router criado uma vez por montagem (e não no escopo do módulo) para os testes
  // conseguirem montar o App mais de uma vez com URLs diferentes.
  const [roteador] = useState(() => createBrowserRouter(rotas));

  return (
    <Provedores>
      <RouterProvider router={roteador} />
    </Provedores>
  );
}
