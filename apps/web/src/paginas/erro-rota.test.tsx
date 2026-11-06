import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { ErroRota } from "./erro-rota";

it("mostra mensagem amigável sem detalhe técnico quando uma página quebra", () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  function Quebra(): never {
    throw new Error("TypeError: cannot read properties of undefined (stack interno)");
  }
  const router = createMemoryRouter([{ path: "/", element: <Quebra />, errorElement: <ErroRota /> }]);
  render(<RouterProvider router={router} />);

  expect(screen.getByRole("heading", { name: "Algo deu errado" })).toBeInTheDocument();
  expect(screen.queryByText(/stack interno/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /recarregar/i })).toBeInTheDocument();
});
