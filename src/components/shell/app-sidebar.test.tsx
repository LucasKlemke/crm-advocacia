import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));

jest.mock("next-auth/react", () => ({
  signOut: jest.fn(),
}));

const mockedUsePathname = usePathname as jest.Mock;

describe("AppSidebar", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ downloadUrl: null }) });
  });

  it("lista os itens de navegação do app", () => {
    mockedUsePathname.mockReturnValue("/clientes");

    render(
      <SidebarProvider>
        <AppSidebar usuario={{ nome: "Fulano de Tal", email: "fulano@teste.com" }} />
      </SidebarProvider>
    );

    expect(screen.getByRole("link", { name: /clientes/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /processos/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /mensagens/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /configurações/i })).toBeInTheDocument();
  });

  it("marca o item da rota atual como ativo", () => {
    mockedUsePathname.mockReturnValue("/casos");

    render(
      <SidebarProvider>
        <AppSidebar usuario={{ nome: "Fulano de Tal", email: "fulano@teste.com" }} />
      </SidebarProvider>
    );

    expect(screen.getByRole("link", { name: /processos/i })).toHaveAttribute("data-active");
    expect(screen.getByRole("link", { name: /clientes/i })).not.toHaveAttribute("data-active");
  });
});
