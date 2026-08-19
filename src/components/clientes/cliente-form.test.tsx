import userEvent from "@testing-library/user-event";
import { renderComQuery, screen, waitFor } from "@/lib/test-utils";
import { ClienteForm } from "./cliente-form";
import type { ClienteDTO } from "@/types/cliente";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const CLIENTE: ClienteDTO = {
  id: "cli-1",
  nome: "Maria Silva",
  cpf: "52998224725",
  email: "maria@ex.com",
  telefone: "5548999990000",
  endereco: null,
  softDeletedAt: null,
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-01T12:00:00.000Z",
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

describe("ClienteForm", () => {
  it("cria um cliente e avisa o chamador", async () => {
    const usuario = userEvent.setup();
    const onSucesso = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ cliente: CLIENTE }),
    } as Response);

    renderComQuery(<ClienteForm onSucesso={onSucesso} />);

    await usuario.type(screen.getByLabelText(/Nome completo/), "Maria Silva");
    await usuario.type(screen.getByLabelText("CPF"), "529.982.247-25");
    await usuario.click(screen.getByRole("button", { name: "Criar cliente" }));

    await waitFor(() => expect(onSucesso).toHaveBeenCalledWith(CLIENTE));
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/clientes");
    expect(JSON.parse(init.body)).toMatchObject({ nome: "Maria Silva", cpf: "529.982.247-25" });
  });

  // O 400 do servidor traz `detalhes` por campo: cada mensagem tem que pousar no campo certo.
  it("exibe o erro do servidor junto do campo correspondente", async () => {
    const usuario = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: "Dados inválidos",
        detalhes: { cpf: ["CPF inválido."] },
      }),
    } as Response);

    renderComQuery(<ClienteForm onSucesso={jest.fn()} />);

    await usuario.type(screen.getByLabelText(/Nome completo/), "Maria Silva");
    await usuario.type(screen.getByLabelText("CPF"), "111.111.111-11");
    await usuario.click(screen.getByRole("button", { name: "Criar cliente" }));

    const erro = await screen.findByRole("alert");
    expect(erro).toHaveTextContent("CPF inválido.");
    expect(screen.getByLabelText("CPF")).toHaveAttribute("aria-invalid", "true");
  });

  it("no modo edição preenche os campos e envia PATCH", async () => {
    const usuario = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ cliente: CLIENTE }),
    } as Response);

    renderComQuery(<ClienteForm cliente={CLIENTE} onSucesso={jest.fn()} />);

    expect(screen.getByLabelText("CPF")).toHaveValue("529.982.247-25");
    // Vem do banco só com dígitos e aparece formatado para edição.
    expect(screen.getByLabelText(/Telefone/)).toHaveValue("+55 (48) 99999-0000");

    await usuario.clear(screen.getByLabelText(/Telefone/));
    await usuario.type(screen.getByLabelText(/Telefone/), "5548988887777");
    await usuario.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe("/api/clientes/cli-1");
      expect(init.method).toBe("PATCH");
      // O campo é mascarado enquanto se digita; o Service normaliza para só dígitos.
      expect(JSON.parse(init.body).telefone).toBe("+55 (48) 98888-7777");
    });
  });

  it("mascara CPF e telefone enquanto o usuário digita", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<ClienteForm onSucesso={jest.fn()} />);

    await usuario.type(screen.getByLabelText("CPF"), "12345678909");
    await usuario.type(screen.getByLabelText(/Telefone/), "5547999998888");

    expect(screen.getByLabelText("CPF")).toHaveValue("123.456.789-09");
    expect(screen.getByLabelText(/Telefone/)).toHaveValue("+55 (47) 99999-8888");
  });

  // Validação no cliente evita um round-trip só para ouvir que o formato está errado.
  it("bloqueia o envio de telefone sem o código do país", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<ClienteForm onSucesso={jest.fn()} />);

    await usuario.type(screen.getByLabelText(/Nome completo/), "Maria Silva");
    await usuario.type(screen.getByLabelText("CPF"), "12345678909");
    await usuario.type(screen.getByLabelText(/Telefone/), "47999998888");
    await usuario.click(screen.getByRole("button", { name: "Criar cliente" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Telefone inválido/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("bloqueia o envio de e-mail malformado", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<ClienteForm onSucesso={jest.fn()} />);

    await usuario.type(screen.getByLabelText(/Nome completo/), "Maria Silva");
    await usuario.type(screen.getByLabelText("CPF"), "12345678909");
    await usuario.type(screen.getByLabelText(/E-mail/), "mariasilvateste");
    await usuario.click(screen.getByRole("button", { name: "Criar cliente" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail inválido.");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("limpa o erro do campo assim que o usuário corrige", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<ClienteForm onSucesso={jest.fn()} />);

    await usuario.type(screen.getByLabelText(/Nome completo/), "Maria Silva");
    await usuario.type(screen.getByLabelText("CPF"), "1234");
    await usuario.click(screen.getByRole("button", { name: "Criar cliente" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await usuario.type(screen.getByLabelText("CPF"), "5678909");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("envia null nos campos opcionais deixados em branco", async () => {
    const usuario = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ cliente: CLIENTE }),
    } as Response);

    renderComQuery(<ClienteForm onSucesso={jest.fn()} />);

    await usuario.type(screen.getByLabelText(/Nome completo/), "Maria Silva");
    await usuario.type(screen.getByLabelText("CPF"), "529.982.247-25");
    await usuario.click(screen.getByRole("button", { name: "Criar cliente" }));

    await waitFor(() => {
      const corpo = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(corpo).toMatchObject({ email: null, telefone: null, endereco: null });
    });
  });
});
