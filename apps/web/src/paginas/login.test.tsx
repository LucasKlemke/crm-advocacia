import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { entrar } from "@/lib/sessao";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { renderPagina } from "@/lib/test-paginas";
import { PaginaLogin, destinoSeguro } from "./login";

jest.mock("@/lib/sessao", () => ({ entrar: jest.fn() }));
jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));

const mockedEntrar = entrar as jest.Mock;

describe("PaginaLogin", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    jest.clearAllMocks();
    Reflect.deleteProperty(window, "location");
    window.location = { href: "", search: "", pathname: "/login" } as never;
  });

  afterAll(() => {
    window.location = originalLocation as never;
  });

  async function enviar(senha = "senha-correta") {
    const user = userEvent.setup();
    renderPagina(<PaginaLogin />, { rota: "/login", caminho: "/login" });
    await user.type(screen.getByLabelText("E-mail"), "fulano@teste.com");
    await user.type(screen.getByLabelText("Senha"), senha);
    await user.click(screen.getByRole("button", { name: /entrar/i }));
  }

  it("define o título da aba", () => {
    renderPagina(<PaginaLogin />, { rota: "/login", caminho: "/login" });
    expect(useTituloPagina).toHaveBeenCalledWith("Entrar");
  });

  it("mostra erro de credencial e não navega quando a API responde 401 (FA-01)", async () => {
    mockedEntrar.mockResolvedValue(false);
    await enviar("senha-errada");
    expect(await screen.findByRole("alert")).toHaveTextContent(/e-mail ou senha inválidos/i);
    expect(window.location.href).toBe("");
  });

  it("mostra erro genérico em falha de rede", async () => {
    mockedEntrar.mockRejectedValue(new Error("Falha ao entrar (HTTP 500)."));
    await enviar();
    expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível entrar/i);
  });

  it("entra e vai para a home", async () => {
    mockedEntrar.mockResolvedValue(true);
    await enviar();
    expect(mockedEntrar).toHaveBeenCalledWith("fulano@teste.com", "senha-correta");
    expect(window.location.href).toBe("/");
  });

  it("volta ao callbackUrl interno depois de entrar", async () => {
    window.location.search = "?callbackUrl=%2Fcasos%2F123";
    mockedEntrar.mockResolvedValue(true);
    await enviar();
    expect(window.location.href).toBe("/casos/123");
  });
});

describe("destinoSeguro", () => {
  it.each([
    [null, "/"],
    ["https://evil.example.com", "/"],
    ["//evil.example.com", "/"],
    ["/clientes", "/clientes"],
  ])("%s → %s", (entrada, esperado) => {
    expect(destinoSeguro(entrada)).toBe(esperado);
  });
});
