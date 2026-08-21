import userEvent from "@testing-library/user-event";
import { renderComQuery, screen, waitFor } from "@/lib/test-utils";
import { ClienteDados } from "./cliente-dados";
import type { ClienteDTO } from "@/types/cliente";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const CLIENTE: ClienteDTO = {
  id: "cli-1",
  nome: "Maria Silva",
  cpf: "52998224725",
  email: "maria@ex.com",
  telefone: "5548999990000",
  endereco: null,
  sexo: null,
  estadoCivil: null,
  nomeMae: null,
  nomePai: null,
  nacionalidade: null,
  nascimento: null,
  profissao: null,
  softDeletedAt: null,
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-01T12:00:00.000Z",
};

function respostaAtualizacao(over: Partial<ClienteDTO> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ cliente: { ...CLIENTE, ...over } }),
  } as Response;
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue(respostaAtualizacao());
});

describe("ClienteDados", () => {
  it("mostra os valores formatados, um por linha", () => {
    renderComQuery(<ClienteDados cliente={CLIENTE} />);

    expect(screen.getByRole("button", { name: "Editar CPF" })).toHaveTextContent(
      "529.982.247-25"
    );
    expect(screen.getByRole("button", { name: "Editar Telefone" })).toHaveTextContent(
      "+55 (48) 99999-0000"
    );
  });

  it("campo opcional em branco aparece como vazio", () => {
    renderComQuery(<ClienteDados cliente={CLIENTE} />);

    expect(screen.getByRole("button", { name: "Editar Endereço" })).toHaveTextContent("Vazio");
  });

  // O botão de salvar só faz sentido depois que algo muda: em leitura ele é ruído.
  it("o botão de salvar só aparece depois de uma alteração", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<ClienteDados cliente={CLIENTE} />);

    await usuario.click(screen.getByRole("button", { name: "Editar Endereço" }));
    expect(screen.queryByRole("button", { name: /Salvar/ })).not.toBeInTheDocument();

    await usuario.type(screen.getByLabelText("Endereço"), "Rua 7, Joinville");

    expect(await screen.findByRole("button", { name: /Salvar/ })).toBeInTheDocument();
  });

  // Um campo por vez: abrir outro fecha o anterior, sem perder o que já foi digitado.
  it("abrir um campo fecha o que estava aberto", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<ClienteDados cliente={CLIENTE} />);

    await usuario.click(screen.getByRole("button", { name: "Editar Nome completo" }));
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Maria Silva");

    await usuario.click(screen.getByRole("button", { name: "Editar Telefone" }));

    expect(screen.getByLabelText("Telefone")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar Nome completo" })).toBeInTheDocument();
  });

  it("clicar fora fecha o campo mantendo o valor digitado, com marca de alterado", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<ClienteDados cliente={CLIENTE} />);

    await usuario.click(screen.getByRole("button", { name: "Editar Endereço" }));
    await usuario.type(screen.getByLabelText("Endereço"), "Rua 7, Joinville");
    await usuario.click(screen.getByRole("button", { name: "Editar CPF" }));

    const linha = screen.getByRole("button", { name: "Editar Endereço" });
    expect(linha).toHaveTextContent("Rua 7, Joinville");
    expect(linha.querySelector("[data-alterado]")).toBeInTheDocument();
    // Campo intocado não ganha a marca.
    expect(
      screen.getByRole("button", { name: "Editar Telefone" }).querySelector("[data-alterado]")
    ).toBeNull();
  });

  // PATCH parcial mantém o diff do log (RN20) restrito ao que o usuário mexeu.
  it("envia no PATCH apenas os campos alterados", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<ClienteDados cliente={CLIENTE} />);

    await usuario.click(screen.getByRole("button", { name: "Editar Telefone" }));
    await usuario.clear(screen.getByLabelText("Telefone"));
    await usuario.type(screen.getByLabelText("Telefone"), "5548988887777");
    await usuario.click(screen.getByRole("button", { name: /Salvar/ }));

    await waitFor(() => {
      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe("/api/clientes/cli-1");
      expect(init.method).toBe("PATCH");
      expect(JSON.parse(init.body)).toEqual({ telefone: "+55 (48) 98888-7777" });
    });
  });

  it("apagar um campo opcional envia null", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<ClienteDados cliente={CLIENTE} />);

    await usuario.click(screen.getByRole("button", { name: "Editar E-mail" }));
    await usuario.clear(screen.getByLabelText("E-mail"));
    await usuario.click(screen.getByRole("button", { name: /Salvar/ }));

    await waitFor(() => {
      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(JSON.parse(init.body)).toEqual({ email: null });
    });
  });

  it("bloqueia o envio de CPF inválido antes de chamar a API", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<ClienteDados cliente={CLIENTE} />);

    await usuario.click(screen.getByRole("button", { name: "Editar CPF" }));
    await usuario.clear(screen.getByLabelText("CPF"));
    await usuario.type(screen.getByLabelText("CPF"), "1234");
    await usuario.click(screen.getByRole("button", { name: /Salvar/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/CPF inválido/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("cancelar devolve os valores originais e fecha os campos", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<ClienteDados cliente={CLIENTE} />);

    await usuario.click(screen.getByRole("button", { name: "Editar Nome completo" }));
    await usuario.type(screen.getByLabelText("Nome completo"), " Souza");
    await usuario.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(screen.getByRole("button", { name: "Editar Nome completo" })).toHaveTextContent(
      "Maria Silva"
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
