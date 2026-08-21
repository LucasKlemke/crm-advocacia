import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { EscritorioForm } from "./escritorio-form";

jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockedUseRouter = useRouter as jest.Mock;

const escritorio = { nome: "Escritório Teste", oabResponsavel: "SC 12345", telefoneWhatsapp: "48999999999" };

describe("EscritorioForm", () => {
  const refresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseRouter.mockReturnValue({ refresh });
    global.fetch = jest.fn();
  });

  it("desabilita os campos e esconde o botão salvar quando somenteLeitura", () => {
    render(<EscritorioForm escritorio={escritorio} somenteLeitura />);

    expect(screen.getByLabelText("Nome do escritório")).toBeDisabled();
    expect(screen.queryByRole("button", { name: /salvar/i })).not.toBeInTheDocument();
  });

  it("envia string vazia para limpar OAB e WhatsApp (não omite os campos)", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    const user = userEvent.setup();

    render(<EscritorioForm escritorio={escritorio} somenteLeitura={false} />);
    await user.clear(screen.getByLabelText("OAB responsável"));
    await user.clear(screen.getByLabelText("WhatsApp"));
    await user.click(screen.getByRole("button", { name: /salvar/i }));

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({
      nome: escritorio.nome,
      oabResponsavel: "",
      telefoneWhatsapp: "",
    });
  });

  it("mantém os valores preenchidos no corpo do PATCH", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    const user = userEvent.setup();

    render(<EscritorioForm escritorio={escritorio} somenteLeitura={false} />);
    await user.click(screen.getByRole("button", { name: /salvar/i }));

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({
      nome: escritorio.nome,
      oabResponsavel: escritorio.oabResponsavel,
      telefoneWhatsapp: escritorio.telefoneWhatsapp,
    });
  });

  it("salva alterações quando não é somente leitura", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    const user = userEvent.setup();

    render(<EscritorioForm escritorio={escritorio} somenteLeitura={false} />);
    await user.click(screen.getByRole("button", { name: /salvar/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/escritorios/atual",
      expect.objectContaining({ method: "PATCH" })
    );
    expect(refresh).toHaveBeenCalled();
  });
});
