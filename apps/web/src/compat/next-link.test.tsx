import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import Link from "./next-link";

function LocalAtual() {
  const { pathname } = useLocation();
  return <p data-testid="local">{pathname}</p>;
}

describe("Link (compat de Link do Next)", () => {
  it("navega pelo React Router e repassa className", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Link href="/perfil" className="item-menu">
          Perfil
        </Link>
        <LocalAtual />
      </MemoryRouter>
    );

    const link = screen.getByRole("link", { name: "Perfil" });
    expect(link).toHaveAttribute("href", "/perfil");
    expect(link).toHaveClass("item-menu");

    await user.click(link);
    expect(screen.getByTestId("local")).toHaveTextContent("/perfil");
  });

  it("não vaza props exclusivas do Next para o DOM", () => {
    render(
      <MemoryRouter>
        <Link href="/casos" prefetch={false} scroll={false}>
          Processos
        </Link>
      </MemoryRouter>
    );

    const link = screen.getByRole("link", { name: "Processos" });
    expect(link).not.toHaveAttribute("prefetch");
    expect(link).not.toHaveAttribute("scroll");
  });

  // Componentes com Link costumam ser testados isolados, sem router (como no Next).
  it("fora de um router vira um <a> comum", () => {
    render(<Link href="/clientes">Clientes</Link>);

    expect(screen.getByRole("link", { name: "Clientes" })).toHaveAttribute("href", "/clientes");
  });
});
