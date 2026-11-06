import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SenhaForm } from "./senha-form";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

describe("SenhaForm", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("envia a senha atual e a nova senha", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    const user = userEvent.setup();

    render(<SenhaForm />);
    await user.type(screen.getByLabelText("Senha atual"), "senha-atual-123");
    await user.type(screen.getByLabelText("Nova senha"), "senha-nova-123");
    await user.click(screen.getByRole("button", { name: /alterar senha/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/perfil/senha",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ senhaAtual: "senha-atual-123", novaSenha: "senha-nova-123" }),
      })
    );
  });

  it("exibe erro do servidor quando a senha atual está incorreta", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "A senha atual informada está incorreta." }),
    });
    const user = userEvent.setup();

    render(<SenhaForm />);
    await user.type(screen.getByLabelText("Senha atual"), "errada");
    await user.type(screen.getByLabelText("Nova senha"), "senha-nova-123");
    await user.click(screen.getByRole("button", { name: /alterar senha/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/incorreta/i);
  });
});
