import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { NovoMembroDrawer } from "./novo-membro-drawer";

jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockedUseRouter = useRouter as jest.Mock;

describe("NovoMembroDrawer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseRouter.mockReturnValue({ refresh: jest.fn() });
  });

  it("abre o drawer com o formulário de convite ao clicar em Novo Membro", async () => {
    const user = userEvent.setup();
    render(<NovoMembroDrawer />);

    expect(screen.queryByLabelText("E-mail do colaborador")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /novo membro/i }));

    expect(await screen.findByLabelText("E-mail do colaborador")).toBeInTheDocument();
    expect(screen.getByText("Convidar colaborador")).toBeInTheDocument();
  });

  it("fecha o drawer após o convite ser enviado com sucesso", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    const user = userEvent.setup();
    render(<NovoMembroDrawer />);

    await user.click(screen.getByRole("button", { name: /novo membro/i }));
    await user.type(await screen.findByLabelText("E-mail do colaborador"), "novo@teste.com");
    await user.click(screen.getByRole("button", { name: /convidar/i }));

    await screen.findByRole("button", { name: /novo membro/i });
    expect(screen.queryByLabelText("E-mail do colaborador")).not.toBeInTheDocument();
  });
});
