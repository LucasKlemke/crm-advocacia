import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { EscritorioSwitcher } from "./escritorio-switcher";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: { error: jest.fn() },
}));

const mockedUseRouter = useRouter as jest.Mock;

const escritorios = [
  { id: "esc-1", nome: "Escritório Um" },
  { id: "esc-2", nome: "Escritório Dois" },
];

describe("EscritorioSwitcher", () => {
  const refresh = jest.fn();
  const push = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseRouter.mockReturnValue({ refresh, push });
    global.fetch = jest.fn();
  });

  it("mostra o escritório ativo no gatilho", () => {
    render(<EscritorioSwitcher escritorios={escritorios} ativoId="esc-1" />);

    expect(screen.getByText("Escritório Um")).toBeInTheDocument();
  });

  it("faz POST com o id certo e chama router.refresh() ao trocar de escritório", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    const user = userEvent.setup();

    render(<EscritorioSwitcher escritorios={escritorios} ativoId="esc-1" />);
    await user.click(screen.getByRole("button", { name: /selecionar escritório/i }));
    await user.click(await screen.findByRole("menuitem", { name: "Escritório Dois" }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/sessao/escritorio-ativo",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ escritorioId: "esc-2" }),
      })
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("abre a dialog de criar escritório em vez de navegar", async () => {
    const user = userEvent.setup();

    render(<EscritorioSwitcher escritorios={escritorios} ativoId="esc-1" />);
    await user.click(screen.getByRole("button", { name: /selecionar escritório/i }));
    await user.click(await screen.findByRole("menuitem", { name: /criar escritório/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do escritório")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
