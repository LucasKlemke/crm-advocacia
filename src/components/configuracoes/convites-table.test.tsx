import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { ConvitesTable } from "./convites-table";

jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockedUseRouter = useRouter as jest.Mock;

describe("ConvitesTable", () => {
  const refresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseRouter.mockReturnValue({ refresh });
    global.fetch = jest.fn();
  });

  it("mostra mensagem quando não há convites pendentes", () => {
    render(<ConvitesTable convites={[]} />);

    expect(screen.getByText(/nenhum convite pendente/i)).toBeInTheDocument();
  });

  it("lista os convites pendentes e cancela ao clicar", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    const user = userEvent.setup();

    render(<ConvitesTable convites={[{ id: "convite-1", email: "pendente@teste.com", role: "padrao" }]} />);
    expect(screen.getByText("pendente@teste.com")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /e-mail/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /cargo/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(global.fetch).toHaveBeenCalledWith("/api/convites/convite-1", { method: "DELETE" });
    expect(refresh).toHaveBeenCalled();
  });

  it("mostra mensagem de erro se a requisição de cancelamento falhar na rede", async () => {
    const { toast } = jest.requireMock("sonner") as { toast: { error: jest.Mock } };
    (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();

    render(<ConvitesTable convites={[{ id: "convite-1", email: "pendente@teste.com", role: "padrao" }]} />);
    await user.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(toast.error).toHaveBeenCalledWith("Não foi possível cancelar o convite.");
  });
});
