import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { chaveSessao } from "@/lib/query/chaves";
import { queryClientRaiz } from "@/lib/query/query-client-raiz";
import { criarQueryClientDeTeste } from "@/lib/test-utils";
import { mockApi, SESSAO_OWNER } from "@/lib/test-paginas";
import { LayoutDashboard } from "./layout-dashboard";

const useTempoRealMock = jest.fn();
jest.mock("@/hooks/use-tempo-real-campanhas", () => ({
  useTempoRealCampanhas: () => useTempoRealMock(),
}));

jest.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarInset: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock("@/components/shell/header-data", () => ({
  HeaderData: ({ data }: { data: string }) => <span data-testid="header-data">{data}</span>,
}));
jest.mock("@/components/shell/app-sidebar", () => ({
  AppSidebar: ({ usuario }: { usuario: { nome: string; email: string } }) => (
    <nav aria-label="sidebar">
      {usuario.nome} {usuario.email}
    </nav>
  ),
}));
jest.mock("@/components/shell/escritorio-switcher", () => ({
  EscritorioSwitcher: ({ escritorios, ativoId }: { escritorios: { id: string; nome: string }[]; ativoId: string }) => (
    <ul aria-label="switcher" data-ativo={ativoId}>
      {escritorios.map((e) => (
        <li key={e.id}>{e.nome}</li>
      ))}
    </ul>
  ),
}));

function renderLayout() {
  const queryClient = criarQueryClientDeTeste();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/clientes"]}>
        <Routes>
          <Route element={<LayoutDashboard />}>
            <Route path="/clientes" element={<p>conteúdo da página</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  queryClientRaiz.setQueryData(chaveSessao(), SESSAO_OWNER);
});

describe("LayoutDashboard", () => {
  it("monta o shell com a página filha, o usuário da sessão e a data de hoje", () => {
    mockApi({ "/api/escritorios": { escritorios: [] } });
    renderLayout();

    expect(screen.getByText("conteúdo da página")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "sidebar" })).toHaveTextContent(
      "Dona Owner owner@teste.com"
    );
    expect(screen.getByTestId("header-data")).not.toBeEmptyDOMElement();
  });

  // Uma conexão por aba, aberta pelo shell: as páginas só leem o cache e o estado.
  it("abre a conexão de tempo real das campanhas", () => {
    mockApi({ "/api/escritorios": { escritorios: [] } });
    renderLayout();

    expect(useTempoRealMock).toHaveBeenCalled();
  });

  it("alimenta o switcher com GET /api/escritorios e o escritório ativo da sessão", async () => {
    mockApi({
      "/api/escritorios": {
        escritorios: [
          { id: "esc-1", nome: "Escritório Um", role: "owner" },
          { id: "esc-2", nome: "Escritório Dois", role: "padrao" },
        ],
      },
    });
    renderLayout();

    expect(await screen.findByText("Escritório Dois")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "switcher" })).toHaveAttribute("data-ativo", "esc-1");
  });
});
