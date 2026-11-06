import { screen } from "@testing-library/react";
import { renderPagina } from "@/lib/test-paginas";
import { PaginaNaoEncontrada } from "./nao-encontrada";

jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));

it("informa que a página não existe e oferece voltar ao início", () => {
  renderPagina(<PaginaNaoEncontrada />, { rota: "/nao-existe", caminho: "*" });
  expect(screen.getByRole("heading", { name: "Página não encontrada" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /voltar ao início/i })).toHaveAttribute("href", "/");
});
