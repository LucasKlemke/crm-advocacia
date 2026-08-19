import { render, screen } from "@testing-library/react";
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

    expect(screen.queryByRole("button", { name: /remover/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("esconde as ações de gestão sobre o próprio ator (auto-alvo)", () => {
    render(<MembrosTable membros={membros} atorUsuarioId="user-1" atorRole="owner" />);

    // A própria linha do ator (owner, user-1) não deve ter select nem botão de remover.
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /remover/i })).toHaveLength(1);
  });

  it("mostra ações de gestão para owner sobre um membro padrao", () => {
    render(<MembrosTable membros={membros} atorUsuarioId="user-1" atorRole="owner" />);

    expect(screen.getByLabelText("Papel de Fulano Padrao")).toBeInTheDocument();
    expect(screen.getByLabelText("Remover Fulano Padrao")).toBeInTheDocument();
  });
});
