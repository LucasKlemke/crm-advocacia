import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { signOut } from "next-auth/react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { NavUsuario } from "./nav-usuario";

jest.mock("next-auth/react", () => ({
  signOut: jest.fn(),
}));

const mockedSignOut = signOut as jest.Mock;

function renderNavUsuario() {
  return render(
    <SidebarProvider>
      <NavUsuario usuario={{ nome: "Fulano de Tal", email: "fulano@teste.com" }} />
    </SidebarProvider>
  );
}

describe("NavUsuario", () => {
  afterEach(() => jest.clearAllMocks());

  it("mostra o nome e o e-mail do usuário no gatilho", () => {
    renderNavUsuario();

    expect(screen.getByText("Fulano de Tal")).toBeInTheDocument();
    expect(screen.getAllByText("fulano@teste.com").length).toBeGreaterThan(0);
  });

  it("renderiza sem quebrar para nome de uma palavra só", () => {
    render(
      <SidebarProvider>
        <NavUsuario usuario={{ nome: "Fulano", email: "fulano@teste.com" }} />
      </SidebarProvider>
    );

    expect(screen.getByText("Fulano")).toBeInTheDocument();
  });

  it("renderiza sem quebrar quando o nome vem vazio", () => {
    render(
      <SidebarProvider>
        <NavUsuario usuario={{ nome: "   ", email: "fulano@teste.com" }} />
      </SidebarProvider>
    );

    expect(screen.getAllByText("fulano@teste.com").length).toBeGreaterThan(0);
  });

  it("abre o menu e mostra o link para Configurações (/perfil)", async () => {
    const user = userEvent.setup();
    renderNavUsuario();

    await user.click(screen.getByRole("button"));

    const link = await screen.findByRole("menuitem", { name: /configurações/i });
    expect(link).toHaveAttribute("href", "/perfil");
  });

  it("aciona signOut ao clicar em Sair", async () => {
    const user = userEvent.setup();
    renderNavUsuario();

    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByRole("menuitem", { name: /sair/i }));

    expect(mockedSignOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });
});
