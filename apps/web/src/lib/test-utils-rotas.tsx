import type { ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { criarQueryClientDeTeste } from "@/lib/test-utils";

export interface OpcoesRenderComRotas extends Omit<RenderOptions, "wrapper"> {
  /** URL inicial, ex.: "/campanhas/7?aba=mensagens". */
  rota?: string;
  /** Padrão do React Router que casa com `rota` — necessário para useParams. */
  padrao?: string;
}

// Para componentes/páginas que usam o compat de navegação de verdade (sem jest.mock):
// QueryClient isolado + MemoryRouter. Fica fora de test-utils.tsx de propósito: aquele
// arquivo ainda é importado pelos testes do Next (via ponte), que não têm o ambiente de
// teste do apps/web — e o React Router exige TextEncoder já no import.
export function renderComRotas(
  ui: ReactElement,
  { rota = "/", padrao = "*", ...opcoes }: OpcoesRenderComRotas = {}
) {
  const queryClient = criarQueryClientDeTeste();
  const resultado = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path={padrao} element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
    opcoes
  );
  return { queryClient, ...resultado };
}
