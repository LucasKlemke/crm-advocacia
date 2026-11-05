import type { ReactElement } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { render } from "@testing-library/react";
import { criarQueryClientDeTeste } from "@/lib/test-utils";
import { chaveSessao } from "@/lib/query/chaves";
import { queryClientRaiz } from "@/lib/query/query-client-raiz";
import type { Sessao } from "@/lib/sessao";

// A sessão semeada por `renderPagina({ sessao })` mora no singleton queryClientRaiz;
// limpar a cada teste impede que ela vaze para o teste seguinte.
afterEach(() => {
  queryClientRaiz.clear();
});

export const SESSAO_OWNER = {
  usuario: { id: "user-1", nome: "Dona Owner", email: "owner@teste.com" },
  escritorioId: "esc-1",
  role: "owner" as const,
};

export const SESSAO_PADRAO = {
  usuario: { id: "user-2", nome: "Colaborador Padrão", email: "padrao@teste.com" },
  escritorioId: "esc-1",
  role: "padrao" as const,
};

// Resposta mínima que o apiFetch aceita (JSON declarado, sem redirect).
export function respostaJson(corpo: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    redirected: false,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => corpo,
  } as unknown as Response;
}

// Mock de fetch por URL exata. Um valor Error vira 500 { error }, e uma URL não
// declarada falha o teste: a página não pode chamar a API além do esperado.
export function mockApi(rotas: Record<string, unknown>) {
  global.fetch = jest.fn(async (url: RequestInfo | URL) => {
    const chave = String(url);
    if (!(chave in rotas)) throw new Error(`fetch inesperado: ${chave}`);
    const corpo = rotas[chave];
    return corpo instanceof Error ? respostaJson({ error: corpo.message }, 500) : respostaJson(corpo);
  }) as jest.Mock;
}

interface OpcoesRender {
  rota?: string;
  caminho?: string;
  outras?: [string, ReactElement][];
  /** Semeia GET /api/auth/sessao no queryClientRaiz (useSessao lê de lá). */
  sessao?: Sessao | null;
}

// Página dentro de um router de memória (Link/Navigate/useParams funcionam) e de um
// QueryClient isolado e sem retry.
export function renderPagina(ui: ReactElement, { rota = "/", caminho = "/", outras = [], sessao }: OpcoesRender = {}) {
  if (sessao !== undefined) queryClientRaiz.setQueryData(chaveSessao(), sessao);
  const queryClient = criarQueryClientDeTeste();
  const resultado = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path={caminho} element={ui} />
          {outras.map(([caminhoOutro, elemento]) => (
            <Route key={caminhoOutro} path={caminhoOutro} element={elemento} />
          ))}
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { queryClient, ...resultado };
}
