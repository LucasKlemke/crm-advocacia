import userEvent from "@testing-library/user-event";
import { renderComQuery, screen, waitFor } from "@/lib/test-utils";
import { TipoProcessoForm } from "./tipo-processo-form";
import type { TipoProcessoDTO } from "@/types/tipo-processo";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const TIPO: TipoProcessoDTO = {
  id: "tipo-processo-1",
  escritorioId: "esc-1",
  nome: "Juros abusivos",
  icone: "Briefcase",
  cor: "#6366f1",
  descricao: null,
  ordem: 1,
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-01T12:00:00.000Z",
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 201,
    json: async () => ({ tipo: TIPO }),
  } as unknown as Response);
});

describe("TipoProcessoForm", () => {
  it("exige o nome", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<TipoProcessoForm onSucesso={jest.fn()} />);

    await usuario.click(screen.getByRole("button", { name: "Criar tipo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Informe o nome do tipo de processo."
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("exige ícone e cor antes de enviar", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<TipoProcessoForm onSucesso={jest.fn()} />);

    await usuario.type(screen.getByLabelText("Nome"), "Juros abusivos");
    await usuario.click(screen.getByRole("button", { name: "Criar tipo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Selecione um ícone.");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("cria o tipo com nome, ícone e cor e devolve o criado em onSucesso", async () => {
    const usuario = userEvent.setup();
    const onSucesso = jest.fn();
    renderComQuery(<TipoProcessoForm onSucesso={onSucesso} />);

    await usuario.type(screen.getByLabelText("Nome"), "Juros abusivos");
    await usuario.click(screen.getByRole("button", { name: "Selecionar ícone" }));
    await usuario.click(await screen.findByRole("option", { name: "Briefcase" }));
    await usuario.click(screen.getByRole("radio", { name: "Cor #6366f1" }));

    await usuario.click(screen.getByRole("button", { name: "Criar tipo" }));

    await waitFor(() => {
      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe("/api/tipos-processo");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body)).toEqual({
        nome: "Juros abusivos",
        icone: "Briefcase",
        cor: "#6366f1",
        descricao: null,
      });
    });
    await waitFor(() => expect(onSucesso).toHaveBeenCalledWith(TIPO));
  });

  it("edita via PATCH quando recebe um tipo existente", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<TipoProcessoForm tipo={TIPO} onSucesso={jest.fn()} />);

    expect(screen.getByLabelText("Nome")).toHaveValue("Juros abusivos");

    await usuario.clear(screen.getByLabelText("Nome"));
    await usuario.type(screen.getByLabelText("Nome"), "Revisional");
    await usuario.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe("/api/tipos-processo/tipo-processo-1");
      expect(init.method).toBe("PATCH");
      expect(JSON.parse(init.body)).toMatchObject({ nome: "Revisional" });
    });
  });

  it("mostra a mensagem do servidor quando o nome já existe", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: "Já existe um tipo de processo com este nome neste escritório.",
      }),
    } as unknown as Response);

    const usuario = userEvent.setup();
    renderComQuery(<TipoProcessoForm onSucesso={jest.fn()} />);

    await usuario.type(screen.getByLabelText("Nome"), "Juros abusivos");
    await usuario.click(screen.getByRole("button", { name: "Selecionar ícone" }));
    await usuario.click(await screen.findByRole("option", { name: "Briefcase" }));
    await usuario.click(screen.getByRole("radio", { name: "Cor #6366f1" }));
    await usuario.click(screen.getByRole("button", { name: "Criar tipo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Já existe um tipo de processo com este nome neste escritório."
    );
  });
});
