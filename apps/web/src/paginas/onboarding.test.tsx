import { screen } from "@testing-library/react";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { renderPagina } from "@/lib/test-paginas";
import { PaginaOnboarding } from "./onboarding";

jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));
jest.mock("@/components/shell/novo-escritorio-form", () => ({
  NovoEscritorioForm: () => <form aria-label="novo escritório" />,
}));

it("mostra o formulário de criação do primeiro escritório", () => {
  renderPagina(<PaginaOnboarding />, { rota: "/onboarding", caminho: "/onboarding" });
  expect(useTituloPagina).toHaveBeenCalledWith("Criar escritório");
  expect(screen.getByRole("heading", { name: /conte-nos sobre o seu escritório/i })).toBeInTheDocument();
  expect(screen.getByRole("form", { name: "novo escritório" })).toBeInTheDocument();
});
