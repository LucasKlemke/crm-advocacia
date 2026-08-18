import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import LoginPage from "./page";

jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

const mockedSignIn = signIn as jest.Mock;
const mockedUseRouter = useRouter as jest.Mock;

describe("LoginPage", () => {
  const push = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseRouter.mockReturnValue({ push });
  });

  it("mantém o usuário na tela com erro para credenciais inválidas (FA-01)", async () => {
    mockedSignIn.mockResolvedValue({ error: "CredentialsSignin", ok: false });
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(screen.getByLabelText("E-mail"), "fulano@teste.com");
    await user.type(screen.getByLabelText("Senha"), "senha-errada");
    await user.click(screen.getByRole("button", { name: /entrar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/e-mail ou senha inválidos/i);
    expect(push).not.toHaveBeenCalled();
  });

  it("redireciona para a home ao logar com sucesso", async () => {
    mockedSignIn.mockResolvedValue({ error: undefined, ok: true });
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(screen.getByLabelText("E-mail"), "fulano@teste.com");
    await user.type(screen.getByLabelText("Senha"), "senha-correta");
    await user.click(screen.getByRole("button", { name: /entrar/i }));

    expect(push).toHaveBeenCalledWith("/");
  });
});
