import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { ConfiguracoesNav } from "./configuracoes-nav";

jest.mock("next/navigation", () => ({ usePathname: jest.fn() }));

const mockedUsePathname = usePathname as jest.Mock;

describe("ConfiguracoesNav", () => {
  it("marca o item da rota atual como ativo", () => {
    mockedUsePathname.mockReturnValue("/configuracoes/usuarios");

    render(<ConfiguracoesNav />);

    expect(screen.getByRole("link", { name: "Usuários" })).toHaveAttribute("data-active");
    expect(screen.getByRole("link", { name: "Escritório" })).not.toHaveAttribute("data-active");
  });
});
