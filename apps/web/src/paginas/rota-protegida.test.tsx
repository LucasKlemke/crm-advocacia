import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { useSessao } from "@/lib/sessao";
import { RotaProtegida, type RotaProtegidaProps } from "./rota-protegida";

jest.mock("@/lib/sessao", () => ({ useSessao: jest.fn() }));

const mockedUseSessao = useSessao as jest.Mock;

const SESSAO_COM_ESCRITORIO = {
  usuario: { id: "user-1", nome: "Fulana", email: "fulana@teste.com" },
  escritorioId: "esc-1",
  role: "owner",
};

function sessaoComo(parcial: Record<string, unknown>) {
  mockedUseSessao.mockReturnValue({
    data: undefined,
    isPending: false,
    isError: false,
    refetch: jest.fn(),
    ...parcial,
  });
}

function LocalAtual() {
  const { pathname, search } = useLocation();
  return <p data-testid="local">{pathname + search}</p>;
}

function montar(rota: string, props?: RotaProtegidaProps) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>
        <Route element={<RotaProtegida {...props} />}>
          <Route path="/clientes" element={<p>conteúdo protegido</p>} />
        </Route>
        <Route path="/login" element={<LocalAtual />} />
        <Route path="/onboarding" element={<LocalAtual />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RotaProtegida", () => {
  it("mostra carregando enquanto a sessão não chegou", () => {
    sessaoComo({ isPending: true });

    montar("/clientes");

    expect(screen.getByRole("status")).toHaveTextContent(/carregando/i);
    expect(screen.queryByText("conteúdo protegido")).not.toBeInTheDocument();
  });

  // RN01: guarda o destino (path + query) no callbackUrl.
  it("sem sessão manda para /login guardando a rota atual", () => {
    sessaoComo({ data: null });

    montar("/clientes?pagina=2");

    expect(screen.getByTestId("local")).toHaveTextContent(
      "/login?callbackUrl=%2Fclientes%3Fpagina%3D2"
    );
  });

  it("sessão sem escritório ativo vai para /onboarding", () => {
    sessaoComo({ data: { ...SESSAO_COM_ESCRITORIO, escritorioId: null, role: null } });

    montar("/clientes");

    expect(screen.getByTestId("local")).toHaveTextContent("/onboarding");
  });

  it("com exigirEscritorio={false} (onboarding) aceita sessão sem escritório", () => {
    sessaoComo({ data: { ...SESSAO_COM_ESCRITORIO, escritorioId: null, role: null } });

    montar("/clientes", { exigirEscritorio: false });

    expect(screen.getByText("conteúdo protegido")).toBeInTheDocument();
  });

  it("renderiza a rota filha com sessão e escritório ativo", () => {
    sessaoComo({ data: SESSAO_COM_ESCRITORIO });

    montar("/clientes");

    expect(screen.getByText("conteúdo protegido")).toBeInTheDocument();
  });

  it("falha ao verificar a sessão mostra alerta e permite tentar de novo", async () => {
    const refetch = jest.fn();
    sessaoComo({ isError: true, refetch });
    const user = userEvent.setup();

    montar("/clientes");

    expect(screen.getByRole("alert")).toHaveTextContent(/não foi possível verificar sua sessão/i);
    await user.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
