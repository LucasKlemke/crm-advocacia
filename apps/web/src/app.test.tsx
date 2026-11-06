import { render, screen } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { queryClientRaiz } from "@/lib/query/query-client-raiz";
import { useSessao } from "@/lib/sessao";
import { App, Provedores } from "./app";

jest.mock("@/lib/sessao", () => ({ useSessao: jest.fn() }));

describe("Provedores", () => {
  it("expõe o queryClientRaiz para a árvore", () => {
    function Sonda() {
      return <p>{useQueryClient() === queryClientRaiz ? "client raiz" : "outro client"}</p>;
    }

    render(
      <Provedores>
        <Sonda />
      </Provedores>
    );

    expect(screen.getByText("client raiz")).toBeInTheDocument();
  });
});

describe("App", () => {
  it("monta o router do browser com a árvore de rotas", async () => {
    (useSessao as jest.Mock).mockReturnValue({
      data: null,
      isPending: false,
      isError: false,
      refetch: jest.fn(),
    });
    window.history.pushState({}, "", "/rota-que-nao-existe");

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Página não encontrada" })).toBeInTheDocument();
  });
});
