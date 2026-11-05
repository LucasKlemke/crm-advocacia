import { render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router";
import { useSessao } from "@/lib/sessao";
import { rotas } from "./rotas";

jest.mock("@/lib/sessao", () => ({ useSessao: jest.fn() }));

jest.mock("./paginas/layouts/layout-dashboard", () => ({
  LayoutDashboard: () => {
    const { Outlet } = jest.requireActual("react-router");
    return <Outlet />;
  },
}));

jest.mock("./paginas/configuracoes/escritorio", () => ({
  PaginaConfiguracoesEscritorio: () => <p>PaginaConfiguracoesEscritorio</p>,
}));
jest.mock("./paginas/configuracoes/membros", () => ({
  PaginaConfiguracoesMembros: () => <p>PaginaConfiguracoesMembros</p>,
}));

const mockedUseSessao = useSessao as jest.Mock;

function navegarPara(rota: string) {
  render(<RouterProvider router={createMemoryRouter(rotas, { initialEntries: [rota] })} />);
}

describe("árvore de rotas", () => {
  beforeEach(() => {
    mockedUseSessao.mockReturnValue({
      data: {
        usuario: { id: "user-1", nome: "Fulana", email: "fulana@teste.com" },
        escritorioId: "esc-1",
        role: "owner",
      },
      isPending: false,
      isError: false,
      refetch: jest.fn(),
    });
  });

  it("/configuracoes redireciona para /configuracoes/escritorio", async () => {
    navegarPara("/configuracoes");

    expect(await screen.findByText("PaginaConfiguracoesEscritorio")).toBeInTheDocument();
  });

  it("as rotas de configurações ficam dentro da nav lateral própria", async () => {
    navegarPara("/configuracoes/membros");

    expect(await screen.findByRole("link", { name: "Membros" })).toHaveAttribute("data-active");
  });

  it("login e cadastro ficam dentro do layout de autenticação", async () => {
    navegarPara("/login");

    expect(await screen.findByRole("link", { name: /crm advocacia/i })).toHaveAttribute("href", "/");
  });

  it("as rotas do dashboard exigem sessão", async () => {
    mockedUseSessao.mockReturnValue({ data: null, isPending: false, isError: false, refetch: jest.fn() });

    navegarPara("/clientes");

    expect(await screen.findByRole("heading", { name: "Bem-vindo(a) de volta" })).toBeInTheDocument();
  });

  it("rota inexistente mostra a página não encontrada", async () => {
    navegarPara("/rota-que-nao-existe");

    expect(await screen.findByRole("heading", { name: "Página não encontrada" })).toBeInTheDocument();
  });
});
