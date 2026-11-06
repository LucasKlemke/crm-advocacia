import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { trocarEscritorio } from "@/lib/sessao";
import { ApiError } from "@/lib/api-client";
import { EscritorioSwitcher } from "./escritorio-switcher";

jest.mock("@/lib/sessao", () => ({ trocarEscritorio: jest.fn() }));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/components/shell/novo-escritorio-form", () => ({
  NovoEscritorioForm: () => <form aria-label="novo escritório" />,
}));

const mockedTrocar = trocarEscritorio as jest.Mock;
const escritorios = [
  { id: "esc-1", nome: "Escritório Um" },
  { id: "esc-2", nome: "Escritório Dois" },
];

beforeEach(() => jest.clearAllMocks());

describe("EscritorioSwitcher", () => {
  it("mostra o escritório ativo no gatilho", () => {
    render(<EscritorioSwitcher escritorios={escritorios} ativoId="esc-1" />);
    expect(screen.getByRole("button", { name: /selecionar escritório/i })).toHaveTextContent("Escritório Um");
  });

  it("troca a sessão para o escritório escolhido", async () => {
    mockedTrocar.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<EscritorioSwitcher escritorios={escritorios} ativoId="esc-1" />);

    await user.click(screen.getByRole("button", { name: /selecionar escritório/i }));
    await user.click(await screen.findByRole("menuitem", { name: "Escritório Dois" }));

    await waitFor(() => expect(mockedTrocar).toHaveBeenCalledWith("esc-2"));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("não chama a API ao escolher o escritório já ativo", async () => {
    const user = userEvent.setup();
    render(<EscritorioSwitcher escritorios={escritorios} ativoId="esc-1" />);

    await user.click(screen.getByRole("button", { name: /selecionar escritório/i }));
    await user.click(await screen.findByRole("menuitem", { name: "Escritório Um" }));

    expect(mockedTrocar).not.toHaveBeenCalled();
  });

  it("mostra o erro da API quando a troca é recusada", async () => {
    mockedTrocar.mockRejectedValue(new ApiError("Você não é membro deste escritório.", 403));
    const user = userEvent.setup();
    render(<EscritorioSwitcher escritorios={escritorios} ativoId="esc-1" />);

    await user.click(screen.getByRole("button", { name: /selecionar escritório/i }));
    await user.click(await screen.findByRole("menuitem", { name: "Escritório Dois" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Você não é membro deste escritório.")
    );
  });

  it("abre a dialog de criar escritório em vez de navegar", async () => {
    const user = userEvent.setup();
    render(<EscritorioSwitcher escritorios={escritorios} ativoId="esc-1" />);

    await user.click(screen.getByRole("button", { name: /selecionar escritório/i }));
    await user.click(await screen.findByRole("menuitem", { name: /criar escritório/i }));

    expect(await screen.findByRole("form", { name: "novo escritório" })).toBeInTheDocument();
  });
});
