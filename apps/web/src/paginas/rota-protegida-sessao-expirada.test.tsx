import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { useSessaoDoEscritorio } from "@/hooks/use-sessao-do-escritorio";
import { chaveSessao } from "@/lib/query/chaves";
import { queryClientRaiz } from "@/lib/query/query-client-raiz";
import { SESSAO_OWNER } from "@/lib/test-paginas";
import { RotaProtegida } from "./rota-protegida";

function PaginaDoEscritorio() {
  return <p>{useSessaoDoEscritorio().usuario.nome}</p>;
}

afterEach(() => queryClientRaiz.clear());

// Sessão que expira e volta null depois de um refresh(): a rota protegida redireciona
// antes de a página filha (useSessaoDoEscritorio lança com sessão null) renderizar.
it("redireciona para /login, sem lançar erro, quando a sessão vira null depois de montada", async () => {
  queryClientRaiz.setQueryData(chaveSessao(), SESSAO_OWNER);
  render(
    <QueryClientProvider client={queryClientRaiz}>
      <MemoryRouter initialEntries={["/clientes"]}>
        <Routes>
          <Route element={<RotaProtegida />}>
            <Route path="/clientes" element={<PaginaDoEscritorio />} />
          </Route>
          <Route path="/login" element={<p>tela de login</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  expect(screen.getByText("Dona Owner")).toBeInTheDocument();

  await act(async () => {
    queryClientRaiz.setQueryData(chaveSessao(), null);
  });

  expect(await screen.findByText("tela de login")).toBeInTheDocument();
});
