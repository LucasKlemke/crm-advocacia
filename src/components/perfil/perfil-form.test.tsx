import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { PerfilForm } from "./perfil-form";

jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockedUseRouter = useRouter as jest.Mock;

describe("PerfilForm", () => {
  const refresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseRouter.mockReturnValue({ refresh });
    global.fetch = jest.fn();
  });

  it("preenche os campos com os dados atuais do usuário", () => {
    render(<PerfilForm usuario={{ nome: "Fulano de Tal", email: "fulano@teste.com" }} />);

    expect(screen.getByLabelText("Nome")).toHaveValue("Fulano de Tal");
    expect(screen.getByLabelText("E-mail")).toHaveValue("fulano@teste.com");
  });

  it("salva as alterações e atualiza a página", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    const user = userEvent.setup();

    render(<PerfilForm usuario={{ nome: "Fulano de Tal", email: "fulano@teste.com" }} />);
    await user.clear(screen.getByLabelText("Nome"));
    await user.type(screen.getByLabelText("Nome"), "Novo Nome");
    await user.click(screen.getByRole("button", { name: /salvar alterações/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/perfil",
      expect.objectContaining({ method: "PATCH" })
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("exibe erro do servidor quando o e-mail já está em uso", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Este e-mail já está cadastrado." }),
    });
    const user = userEvent.setup();

    render(<PerfilForm usuario={{ nome: "Fulano de Tal", email: "fulano@teste.com" }} />);
    await user.click(screen.getByRole("button", { name: /salvar alterações/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/já está cadastrado/i);
    expect(refresh).not.toHaveBeenCalled();
  });
});
