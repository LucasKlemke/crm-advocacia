import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { MembrosTable } from "./membros-table";

jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockedUseRouter = useRouter as jest.Mock;

const membros = [
  { id: "membro-1", role: "owner" as const, usuario: { id: "user-1", nome: "Dona Owner", email: "owner@teste.com" } },
  { id: "membro-2", role: "padrao" as const, usuario: { id: "user-2", nome: "Fulano Padrao", email: "padrao@teste.com" } },
];

describe("MembrosTable", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseRouter.mockReturnValue({ refresh: jest.fn() });
  });

  it("lista nome e e-mail de todos os membros", () => {
    render(<MembrosTable membros={membros} atorUsuarioId="user-1" atorRole="owner" />);

    expect(screen.getByText("Dona Owner")).toBeInTheDocument();
    expect(screen.getByText("owner@teste.com")).toBeInTheDocument();
    expect(screen.getByText("Fulano Padrao")).toBeInTheDocument();
  });

  it("esconde as ações de gestão quando o ator é padrao", () => {
    render(<MembrosTable membros={membros} atorUsuarioId="user-2" atorRole="padrao" />);

    expect(screen.queryByRole("button", { name: /ações de/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("esconde as ações de gestão sobre o próprio ator (auto-alvo)", () => {
    render(<MembrosTable membros={membros} atorUsuarioId="user-1" atorRole="owner" />);

    // A própria linha do ator (owner, user-1) não deve ter select nem menu de ações.
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /ações de/i })).toHaveLength(1);
  });

  it("mostra ações de gestão para owner sobre um membro padrao", () => {
    render(<MembrosTable membros={membros} atorUsuarioId="user-1" atorRole="owner" />);

    expect(screen.getByLabelText("Cargo de Fulano Padrao")).toBeInTheDocument();
    expect(screen.getByLabelText("Ações de Fulano Padrao")).toBeInTheDocument();
  });

  it("remove o membro após confirmar no menu de ações", async () => {
    (global.fetch as jest.Mock | undefined) = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    const refresh = jest.fn();
    mockedUseRouter.mockReturnValue({ refresh });
    const user = userEvent.setup();

    render(<MembrosTable membros={membros} atorUsuarioId="user-1" atorRole="owner" />);

    await user.click(screen.getByLabelText("Ações de Fulano Padrao"));
    await user.click(await screen.findByRole("menuitem", { name: "Remover" }));
    await user.click(await screen.findByRole("button", { name: "Remover" }));

    expect(global.fetch).toHaveBeenCalledWith("/api/membros/membro-2", { method: "DELETE" });
    expect(refresh).toHaveBeenCalled();
  });

  it("mostra o nome do membro no diálogo de confirmação", async () => {
    const user = userEvent.setup();
    render(<MembrosTable membros={membros} atorUsuarioId="user-1" atorRole="owner" />);

    await user.click(screen.getByLabelText("Ações de Fulano Padrao"));
    await user.click(await screen.findByRole("menuitem", { name: "Remover" }));

    expect(screen.getByText(/fulano padrao perderá acesso/i)).toBeInTheDocument();
  });

  it("mostra mensagem de erro se a remoção falhar na rede", async () => {
    const { toast } = jest.requireMock("sonner") as { toast: { error: jest.Mock } };
    (global.fetch as jest.Mock | undefined) = jest.fn().mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();

    render(<MembrosTable membros={membros} atorUsuarioId="user-1" atorRole="owner" />);

    await user.click(screen.getByLabelText("Ações de Fulano Padrao"));
    await user.click(await screen.findByRole("menuitem", { name: "Remover" }));
    await user.click(await screen.findByRole("button", { name: "Remover" }));

    expect(toast.error).toHaveBeenCalledWith("Não foi possível remover o membro.");
  });

  it("mostra mensagem de erro se a alteração de cargo falhar na rede", async () => {
    const { toast } = jest.requireMock("sonner") as { toast: { error: jest.Mock } };
    (global.fetch as jest.Mock | undefined) = jest.fn().mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();

    render(<MembrosTable membros={membros} atorUsuarioId="user-1" atorRole="owner" />);

    await user.click(screen.getByLabelText("Cargo de Fulano Padrao"));
    await user.click(await screen.findByRole("option", { name: "Administrador" }));

    expect(toast.error).toHaveBeenCalledWith("Não foi possível alterar o papel do membro.");
  });

  it("mostra o label do cargo no select do membro, não o valor cru", () => {
    render(<MembrosTable membros={membros} atorUsuarioId="user-1" atorRole="owner" />);

    const select = screen.getByLabelText("Cargo de Fulano Padrao");
    expect(select).toHaveTextContent("Padrão");
    expect(select).not.toHaveTextContent("padrao");
  });
});
