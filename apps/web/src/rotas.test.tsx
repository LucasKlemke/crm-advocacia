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

const mockedUseSessao = useSessao as jest.Mock;

function navegarPara(rota: string) {
  render(<RouterProvider router={createMemoryRouter(rotas, { initialEntries: [rota] })} />);
}

// Rota React Router → página do Next que ela ainda espera. A parte B remove cada linha
// ao portar a página correspondente.
const ROTAS_EM_MIGRACAO: [string, string][] = [
  ["/perfil", "src/app/(dashboard)/perfil/page.tsx"],
  ["/configuracoes/escritorio", "src/app/(dashboard)/configuracoes/escritorio/page.tsx"],
  ["/configuracoes/membros", "src/app/(dashboard)/configuracoes/membros/page.tsx"],
  ["/configuracoes/status", "src/app/(dashboard)/configuracoes/status/page.tsx"],
  ["/configuracoes/tipos-processo", "src/app/(dashboard)/configuracoes/tipos-processo/page.tsx"],
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

  it.each(ROTAS_EM_MIGRACAO)("%s aponta para %s", async (rota, caminhoNext) => {
    navegarPara(rota);

    expect(await screen.findByText(caminhoNext)).toBeInTheDocument();
  });

  it("/configuracoes redireciona para /configuracoes/escritorio", async () => {
    navegarPara("/configuracoes");

    expect(
      await screen.findByText("src/app/(dashboard)/configuracoes/escritorio/page.tsx")
    ).toBeInTheDocument();
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
