import { screen } from "@testing-library/react";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { renderPagina, SESSAO_OWNER } from "@/lib/test-paginas";
import { PaginaClientes } from "./clientes";

jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));
jest.mock("@/components/clientes/clientes-table", () => ({
  ClientesTable: (props: Record<string, string>) => <pre data-testid="tabela">{JSON.stringify(props)}</pre>,
}));

it("mostra o cabeçalho e passa o ator da sessão à tabela", () => {
  renderPagina(<PaginaClientes />, { rota: "/clientes", caminho: "/clientes", sessao: SESSAO_OWNER });

  expect(useTituloPagina).toHaveBeenCalledWith("Clientes");
  expect(screen.getByRole("heading", { name: "Clientes" })).toBeInTheDocument();
  expect(JSON.parse(screen.getByTestId("tabela").textContent ?? "{}")).toEqual({
    atorUsuarioId: "user-1",
    atorNome: "Dona Owner",
    atorRole: "owner",
  });
});
