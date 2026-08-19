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
});
