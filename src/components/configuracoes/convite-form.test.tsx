import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { ConviteForm } from "./convite-form";

jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockedUseRouter = useRouter as jest.Mock;

describe("ConviteForm", () => {
  const refresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseRouter.mockReturnValue({ refresh });
    global.fetch = jest.fn();
  });

  it("envia o convite com e-mail e papel padrao", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    const user = userEvent.setup();

    render(<ConviteForm />);
    await user.type(screen.getByLabelText("E-mail do colaborador"), "novo@teste.com");
    await user.click(screen.getByRole("button", { name: /convidar/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/convites",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "novo@teste.com", role: "padrao" }),
      })
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("exibe o erro retornado pelo servidor", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Já existe um convite pendente para este e-mail." }),
    });
    const user = userEvent.setup();

    render(<ConviteForm />);
    await user.type(screen.getByLabelText("E-mail do colaborador"), "novo@teste.com");
    await user.click(screen.getByRole("button", { name: /convidar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/já existe um convite/i);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("volta o cargo para padrao após um envio bem-sucedido, mesmo tendo escolhido outro cargo antes", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    const user = userEvent.setup();

    render(<ConviteForm />);
    await user.click(screen.getByLabelText("Cargo"));
    await user.click(await screen.findByRole("option", { name: "Administrador" }));
    await user.type(screen.getByLabelText("E-mail do colaborador"), "primeiro@teste.com");
    await user.click(screen.getByRole("button", { name: /convidar/i }));

    expect(global.fetch).toHaveBeenLastCalledWith(
      "/api/convites",
      expect.objectContaining({
        body: JSON.stringify({ email: "primeiro@teste.com", role: "admin" }),
      })
    );

    await user.clear(screen.getByLabelText("E-mail do colaborador"));
    await user.type(screen.getByLabelText("E-mail do colaborador"), "segundo@teste.com");
    await user.click(screen.getByRole("button", { name: /convidar/i }));

    expect(global.fetch).toHaveBeenLastCalledWith(
      "/api/convites",
      expect.objectContaining({
        body: JSON.stringify({ email: "segundo@teste.com", role: "padrao" }),
      })
    );
  });

  // Base UI mostra o valor cru no gatilho quando o SelectValue não formata: o usuário
  // escolhia "Administrador" e via "admin".
  it("mostra o label do cargo escolhido no gatilho, não o valor cru", async () => {
    const user = userEvent.setup();

    render(<ConviteForm />);
    const gatilho = screen.getByLabelText("Cargo");
    expect(gatilho).toHaveTextContent("Padrão");

    await user.click(gatilho);
    await user.click(await screen.findByRole("option", { name: "Administrador" }));

    expect(gatilho).toHaveTextContent("Administrador");
    expect(gatilho).not.toHaveTextContent("admin");
  });
});
