import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { entrar } from "@/lib/sessao";
import { renderPagina, respostaJson } from "@/lib/test-paginas";
import { PaginaCadastro } from "./cadastro";

jest.mock("@/lib/sessao", () => ({ entrar: jest.fn() }));
jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));

const mockedEntrar = entrar as jest.Mock;

async function preencher(senha = "senha-forte-123", confirmar = senha) {
  const user = userEvent.setup();
  renderPagina(<PaginaCadastro />, { rota: "/cadastro", caminho: "/cadastro" });
  await user.type(screen.getByLabelText("Seu nome"), "Fulano de Tal");
  await user.type(screen.getByLabelText("E-mail"), "fulano@teste.com");
  await user.type(screen.getByLabelText("Senha"), senha);
  await user.type(screen.getByLabelText("Confirmar senha"), confirmar);
  await user.click(screen.getByRole("button", { name: /cadastrar/i }));
}

describe("PaginaCadastro", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    Reflect.deleteProperty(window, "location");
    window.location = { href: "" } as never;
  });

  afterAll(() => {
    window.location = originalLocation as never;
  });

  it("não envia quando a confirmação de senha não bate", async () => {
    await preencher("senha-forte-123", "outra-senha-999");
    expect(await screen.findByRole("alert")).toHaveTextContent(/as senhas não coincidem/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("mostra o erro da API de cadastro", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson({ error: "E-mail já cadastrado." }, 409));
    await preencher();
    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail já cadastrado.");
    expect(mockedEntrar).not.toHaveBeenCalled();
  });

  it("cadastra, entra e segue para o onboarding quando não há escritório", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson({ temEscritorio: false }, 201));
    mockedEntrar.mockResolvedValue(true);
    await preencher();
    expect(mockedEntrar).toHaveBeenCalledWith("fulano@teste.com", "senha-forte-123");
    expect(window.location.href).toBe("/onboarding");
  });

  it("vai direto para a home quando o cadastro aceitou um convite", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson({ temEscritorio: true }, 201));
    mockedEntrar.mockResolvedValue(true);
    await preencher();
    expect(window.location.href).toBe("/");
  });

  it("manda ao login se o login automático falhar", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson({ temEscritorio: false }, 201));
    mockedEntrar.mockRejectedValue(new Error("falhou"));
    await preencher();
    expect(window.location.href).toBe("/login");
  });

  it("manda ao login se o login automático devolver credencial inválida", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson({ temEscritorio: true }, 201));
    mockedEntrar.mockResolvedValue(false);
    await preencher();
    expect(window.location.href).toBe("/login");
  });
});
