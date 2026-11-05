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
jest.mock("./paginas/login", () => ({ PaginaLogin: () => <p>PaginaLogin</p> }));
jest.mock("./paginas/cadastro", () => ({ PaginaCadastro: () => <p>PaginaCadastro</p> }));
jest.mock("./paginas/onboarding", () => ({ PaginaOnboarding: () => <p>PaginaOnboarding</p> }));
jest.mock("./paginas/inicio", () => ({ PaginaInicio: () => <p>PaginaInicio</p> }));
jest.mock("./paginas/clientes", () => ({ PaginaClientes: () => <p>PaginaClientes</p> }));
jest.mock("./paginas/casos", () => ({ PaginaCasos: () => <p>PaginaCasos</p> }));
jest.mock("./paginas/agenda", () => ({ PaginaAgenda: () => <p>PaginaAgenda</p> }));
jest.mock("./paginas/campanhas/lista", () => ({ PaginaCampanhas: () => <p>PaginaCampanhas</p> }));
jest.mock("./paginas/campanhas/nova", () => ({ PaginaNovaCampanha: () => <p>PaginaNovaCampanha</p> }));
jest.mock("./paginas/campanhas/detalhe", () => ({ PaginaCampanha: () => <p>PaginaCampanha</p> }));
jest.mock("./paginas/instancias", () => ({ PaginaInstancias: () => <p>PaginaInstancias</p> }));
jest.mock("./paginas/perfil", () => ({ PaginaPerfil: () => <p>PaginaPerfil</p> }));
jest.mock("./paginas/configuracoes/escritorio", () => ({
  PaginaConfiguracoesEscritorio: () => <p>PaginaConfiguracoesEscritorio</p>,
}));
jest.mock("./paginas/configuracoes/membros", () => ({
  PaginaConfiguracoesMembros: () => <p>PaginaConfiguracoesMembros</p>,
}));
jest.mock("./paginas/configuracoes/status", () => ({
  PaginaConfiguracoesStatus: () => <p>PaginaConfiguracoesStatus</p>,
}));
jest.mock("./paginas/configuracoes/tipos-processo", () => ({
  PaginaConfiguracoesTiposProcesso: () => <p>PaginaConfiguracoesTiposProcesso</p>,
}));

const mockedUseSessao = useSessao as jest.Mock;

function navegarPara(rota: string) {
  render(<RouterProvider router={createMemoryRouter(rotas, { initialEntries: [rota] })} />);
}

const ROTAS: [string, string][] = [
  ["/login", "PaginaLogin"],
  ["/cadastro", "PaginaCadastro"],
  ["/onboarding", "PaginaOnboarding"],
  ["/", "PaginaInicio"],
  ["/clientes", "PaginaClientes"],
  ["/casos", "PaginaCasos"],
  ["/agenda", "PaginaAgenda"],
  ["/campanhas", "PaginaCampanhas"],
  ["/campanhas/nova", "PaginaNovaCampanha"],
  ["/campanhas/abc123", "PaginaCampanha"],
  ["/instancias", "PaginaInstancias"],
  ["/perfil", "PaginaPerfil"],
  ["/configuracoes/escritorio", "PaginaConfiguracoesEscritorio"],
  ["/configuracoes/membros", "PaginaConfiguracoesMembros"],
  ["/configuracoes/status", "PaginaConfiguracoesStatus"],
  ["/configuracoes/tipos-processo", "PaginaConfiguracoesTiposProcesso"],
];

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

  it.each(ROTAS)("%s renderiza %s", async (rota, pagina) => {
    navegarPara(rota);

    expect(await screen.findByText(pagina)).toBeInTheDocument();
  });

  it("/configuracoes redireciona para /configuracoes/escritorio", async () => {
    navegarPara("/configuracoes");

    expect(await screen.findByText("PaginaConfiguracoesEscritorio")).toBeInTheDocument();
  });

  it("as rotas de configurações ficam dentro da nav lateral própria", async () => {
    navegarPara("/configuracoes/membros");

    expect(await screen.findByRole("link", { name: "Membros" })).toHaveAttribute("data-active");
  });

  it("as rotas do dashboard exigem sessão", async () => {
    mockedUseSessao.mockReturnValue({ data: null, isPending: false, isError: false, refetch: jest.fn() });

    navegarPara("/clientes");

    expect(await screen.findByText("PaginaLogin")).toBeInTheDocument();
  });

  it("rota inexistente mostra a página não encontrada", async () => {
    navegarPara("/rota-que-nao-existe");

    expect(await screen.findByRole("heading", { name: "Página não encontrada" })).toBeInTheDocument();
  });
});
