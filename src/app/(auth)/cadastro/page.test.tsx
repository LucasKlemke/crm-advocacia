import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { signIn } from "next-auth/react";
import CadastroPage from "./page";

jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
}));

const mockedSignIn = signIn as jest.Mock;

async function preencherFormulario(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Seu nome"), "Fulano de Tal");
  await user.type(screen.getByLabelText("E-mail"), "fulano@teste.com");
  await user.type(screen.getByLabelText("Senha"), "senha-forte-123");
}

describe("CadastroPage", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    // Navegação pós-cadastro/login usa window.location.href (não router.push) — ver
    // comentário no componente sobre o Router Cache stale pós-login.
    Reflect.deleteProperty(window, "location");
    window.location = { href: "" } as never;
  });

  afterAll(() => {
    window.location = originalLocation as never;
  });

  it("exibe erro quando e-mail já está cadastrado", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Este e-mail já está cadastrado." }),
    });
    const user = userEvent.setup();

    render(<CadastroPage />);
    await preencherFormulario(user);
    await user.click(screen.getByRole("button", { name: /cadastrar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/já está cadastrado/i);
    expect(mockedSignIn).not.toHaveBeenCalled();
    expect(window.location.href).toBe("");
  });

  it("cadastra, loga automaticamente e vai para o onboarding quando não tem escritório", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ temEscritorio: false }),
    });
    mockedSignIn.mockResolvedValue({ error: undefined, ok: true });
    const user = userEvent.setup();

    render(<CadastroPage />);
    await preencherFormulario(user);
    await user.click(screen.getByRole("button", { name: /cadastrar/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/cadastro",
      expect.objectContaining({ method: "POST" })
    );
    expect(window.location.href).toBe("/onboarding");
  });

  it("cadastra e vai direto para a home quando já tem escritório (convite consumido)", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ temEscritorio: true }),
    });
    mockedSignIn.mockResolvedValue({ error: undefined, ok: true });
    const user = userEvent.setup();

    render(<CadastroPage />);
    await preencherFormulario(user);
    await user.click(screen.getByRole("button", { name: /cadastrar/i }));

    expect(window.location.href).toBe("/");
  });
});
