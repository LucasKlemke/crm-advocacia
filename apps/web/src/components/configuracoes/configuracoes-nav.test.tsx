import { render, screen } from "@testing-library/react";
import { usePathname } from "@/compat/next-navigation";
import { ConfiguracoesNav } from "./configuracoes-nav";

jest.mock("@/compat/next-navigation", () => ({ usePathname: jest.fn() }));

const mockedUsePathname = usePathname as jest.Mock;

describe("ConfiguracoesNav", () => {
  it("marca o item da rota atual como ativo", () => {
    mockedUsePathname.mockReturnValue("/configuracoes/membros");

    render(<ConfiguracoesNav />);

    expect(screen.getByRole("link", { name: "Membros" })).toHaveAttribute("data-active");
    expect(screen.getByRole("link", { name: "Escritório" })).not.toHaveAttribute("data-active");
  });
});
