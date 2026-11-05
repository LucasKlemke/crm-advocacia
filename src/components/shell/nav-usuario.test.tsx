import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { sair } from "@/lib/auth/cliente-sessao";
import { SidebarProvider } from "@/components/ui/sidebar";
import { NavUsuario } from "./nav-usuario";

jest.mock("@/lib/auth/cliente-sessao", () => ({ sair: jest.fn() }));
jest.mock("@/components/shared/avatar-iniciais", () => ({
  AvatarIniciais: ({ nome, avatarUrl }: { nome: string; avatarUrl?: string | null }) => (
    <div data-testid={`avatar-${nome}`} data-avatar-url={avatarUrl ?? ""} />
  ),
}));

const mockedSair = sair as jest.Mock;

function renderNavUsuario() {
  return render(
    <SidebarProvider>
      <NavUsuario usuario={{ nome: "Fulano de Tal", email: "fulano@teste.com" }} />
    </SidebarProvider>
  );
}

describe("NavUsuario", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ downloadUrl: null }) });
  });

  afterEach(() => jest.clearAllMocks());

  it("mostra o nome e o e-mail do usuário no gatilho", () => {
    renderNavUsuario();

    expect(screen.getByText("Fulano de Tal")).toBeInTheDocument();
    expect(screen.getAllByText("fulano@teste.com").length).toBeGreaterThan(0);
  });

  it("busca a própria URL de avatar assinada e repassa pro AvatarIniciais", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ downloadUrl: "https://bucket.s3.amazonaws.com/signed-get" }),
    });
    renderNavUsuario();

    expect(global.fetch).toHaveBeenCalledWith("/api/perfil/avatar/download-url");
    await waitFor(() =>
      expect(screen.getByTestId("avatar-Fulano de Tal")).toHaveAttribute(
        "data-avatar-url",
        "https://bucket.s3.amazonaws.com/signed-get"
      )
    );
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

  it("encerra a sessão na API e vai para /login ao clicar em Sair", async () => {
    const originalLocation = window.location;
    Reflect.deleteProperty(window, "location");
    window.location = { href: "" } as never;
    mockedSair.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderNavUsuario();

    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByRole("menuitem", { name: /sair/i }));

    expect(mockedSair).toHaveBeenCalled();
    await waitFor(() => expect(window.location.href).toBe("/login"));
    window.location = originalLocation as never;
  });
});
