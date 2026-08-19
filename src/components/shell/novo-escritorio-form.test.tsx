import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NovoEscritorioForm } from "./novo-escritorio-form";

describe("NovoEscritorioForm", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    global.fetch = jest.fn();
    // Navega via window.location.href (não router.push) — ver comentário no
    // componente sobre o Router Cache stale ao trocar de escritório ativo.
    Reflect.deleteProperty(window, "location");
    window.location = { href: "" } as never;
  });

  afterAll(() => {
    window.location = originalLocation as never;
  });

  it("cria o escritório e redireciona para a home", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    const user = userEvent.setup();

    render(<NovoEscritorioForm />);
    await user.type(screen.getByLabelText("Nome do escritório"), "Escritório Teste");
    await user.click(screen.getByRole("button", { name: /criar escritório/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/escritorios",
      expect.objectContaining({ method: "POST" })
    );
    expect(window.location.href).toBe("/");
  });

  it("exibe erro do servidor sem redirecionar", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Não foi possível criar o escritório." }),
    });
    const user = userEvent.setup();

    render(<NovoEscritorioForm />);
    await user.type(screen.getByLabelText("Nome do escritório"), "Escritório Teste");
    await user.click(screen.getByRole("button", { name: /criar escritório/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível/i);
    expect(window.location.href).toBe("");
  });
});
