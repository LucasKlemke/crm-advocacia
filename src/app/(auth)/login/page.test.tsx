import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { entrar } from "@/lib/auth/cliente-sessao";
import LoginPage from "./page";

jest.mock("@/lib/auth/cliente-sessao", () => ({ entrar: jest.fn() }));

const mockedEntrar = entrar as jest.Mock;

describe("LoginPage", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    jest.clearAllMocks();
    // Login com sucesso navega via window.location.href (não router.push) — ver
    // comentário no componente sobre o Router Cache stale pós-login.
    Reflect.deleteProperty(window, "location");
    window.location = { href: "", search: "" } as never;
  });

  afterAll(() => {
    window.location = originalLocation as never;
  });

  it("mantém o usuário na tela com erro para credenciais inválidas (FA-01)", async () => {
    mockedEntrar.mockResolvedValue(false);
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(screen.getByLabelText("E-mail"), "fulano@teste.com");
    await user.type(screen.getByLabelText("Senha"), "senha-errada");
    await user.click(screen.getByRole("button", { name: /entrar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/e-mail ou senha inválidos/i);
    expect(mockedEntrar).toHaveBeenCalledWith("fulano@teste.com", "senha-errada");
    expect(window.location.href).toBe("");
  });

  it("redireciona para a home ao logar com sucesso", async () => {
    mockedEntrar.mockResolvedValue(true);
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(screen.getByLabelText("E-mail"), "fulano@teste.com");
    await user.type(screen.getByLabelText("Senha"), "senha-correta");
    await user.click(screen.getByRole("button", { name: /entrar/i }));

    expect(window.location.href).toBe("/");
  });

  it("exibe erro genérico quando entrar lança uma exceção (ex.: falha de rede)", async () => {
    mockedEntrar.mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(screen.getByLabelText("E-mail"), "fulano@teste.com");
    await user.type(screen.getByLabelText("Senha"), "senha-correta");
    await user.click(screen.getByRole("button", { name: /entrar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível entrar/i);
    expect(window.location.href).toBe("");
  });

  it("redireciona para o callbackUrl informado na query string ao logar com sucesso", async () => {
    window.location.search = "?callbackUrl=%2Fcasos%2F123";
    mockedEntrar.mockResolvedValue(true);
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(screen.getByLabelText("E-mail"), "fulano@teste.com");
    await user.type(screen.getByLabelText("Senha"), "senha-correta");
    await user.click(screen.getByRole("button", { name: /entrar/i }));

    expect(window.location.href).toBe("/casos/123");
  });

  it("ignora callbackUrl absoluto/externo e redireciona para a home (evita open redirect)", async () => {
    window.location.search = "?callbackUrl=https%3A%2F%2Fevil.example.com";
    mockedEntrar.mockResolvedValue(true);
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(screen.getByLabelText("E-mail"), "fulano@teste.com");
    await user.type(screen.getByLabelText("Senha"), "senha-correta");
    await user.click(screen.getByRole("button", { name: /entrar/i }));

    expect(window.location.href).toBe("/");
  });
});
