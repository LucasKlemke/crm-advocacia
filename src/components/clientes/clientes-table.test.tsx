import userEvent from "@testing-library/user-event";
import { renderComQuery, screen, waitFor, within } from "@/lib/test-utils";
import { ClientesTable } from "./clientes-table";
import type { ClienteDTO } from "@/types/cliente";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

function clienteFake(over: Partial<ClienteDTO> = {}): ClienteDTO {
  return {
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
    ...over,
  };
}

const MARIA = clienteFake();
const JOAO = clienteFake({ id: "cli-2", nome: "João Souza", cpf: "16899535009" });

function respostaListagem(clientes: ClienteDTO[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ clientes, total: clientes.length, pagina: 1, porPagina: 20 }),
  } as Response;
}

function renderTabela() {
  return renderComQuery(<ClientesTable atorUsuarioId="user-1" atorNome="Ana Titular" atorRole="owner" />);
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue(respostaListagem([MARIA, JOAO]));
});

describe("ClientesTable", () => {
  it("lista os clientes com o CPF formatado", async () => {
    renderTabela();

    expect(await screen.findByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("529.982.247-25")).toBeInTheDocument();
  });

  it("mostra quando o cadastro foi atualizado pela última vez", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaListagem([clienteFake({ updatedAt: "2026-08-15T18:30:00.000Z" })])
    );
    renderTabela();

    expect(await screen.findByRole("columnheader", { name: "Atualizado em" })).toBeInTheDocument();
    expect(await screen.findByRole("cell", { name: /15\/08\/2026\s+15:30/ })).toBeInTheDocument();
  });

  it("não mostra a barra de ações em lote enquanto nada está selecionado", async () => {
    renderTabela();
    await screen.findByText("Maria Silva");

    expect(screen.queryByRole("region", { name: "Ações em lote" })).not.toBeInTheDocument();
  });

  it("selecionar linhas revela a barra de ações em lote", async () => {
    const usuario = userEvent.setup();
    renderTabela();
    await screen.findByText("Maria Silva");

    await usuario.click(screen.getByRole("checkbox", { name: "Selecionar Maria Silva" }));

    const barra = await screen.findByRole("region", { name: "Ações em lote" });
    expect(within(barra).getByText("1 selecionado(s)")).toBeInTheDocument();
  });

  it("o checkbox do cabeçalho seleciona todas as linhas ativas", async () => {
    const usuario = userEvent.setup();
    renderTabela();
    await screen.findByText("Maria Silva");

    await usuario.click(screen.getByRole("checkbox", { name: "Selecionar todos os clientes" }));

    const barra = await screen.findByRole("region", { name: "Ações em lote" });
    expect(within(barra).getByText("2 selecionado(s)")).toBeInTheDocument();
  });

  it("desativar em lote confirma e envia os ids selecionados para a API", async () => {
    const usuario = userEvent.setup();
    renderTabela();
    await screen.findByText("Maria Silva");

    await usuario.click(screen.getByRole("checkbox", { name: "Selecionar Maria Silva" }));
    await usuario.click(screen.getByRole("checkbox", { name: "Selecionar João Souza" }));

    const barra = await screen.findByRole("region", { name: "Ações em lote" });
    await usuario.click(within(barra).getByRole("button", { name: "Desativar" }));

    const dialogo = await screen.findByRole("alertdialog");
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ desativados: 2, ignorados: 0 }),
    } as Response);
    await usuario.click(within(dialogo).getByRole("button", { name: "Desativar" }));

    await waitFor(() => {
      const chamadaLote = (global.fetch as jest.Mock).mock.calls.find(
        ([url]) => url === "/api/clientes/lote"
      );
      expect(chamadaLote).toBeDefined();
      expect(JSON.parse(chamadaLote[1].body)).toEqual({
        ids: ["cli-1", "cli-2"],
        acao: "desativar",
      });
    });
  });

  // Cliente já excluído não pode entrar numa nova desativação em lote.
  it("não permite selecionar um cliente já excluído", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaListagem([clienteFake({ softDeletedAt: "2026-08-10T12:00:00.000Z" })])
    );
    renderTabela();
    await screen.findByText("Maria Silva");

    expect(screen.getByRole("checkbox", { name: "Selecionar Maria Silva" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(screen.getByText("Excluído")).toBeInTheDocument();
  });

  // A coluna de ações saiu: a linha inteira é o gatilho para abrir o cadastro.
  it("clicar na linha abre o drawer do cliente", async () => {
    const usuario = userEvent.setup();
    renderTabela();

    await usuario.click(await screen.findByText("Maria Silva"));

    expect(await screen.findByRole("button", { name: "Desativar cliente" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar CPF" })).toHaveTextContent("529.982.247-25");
  });

  it("marcar o checkbox seleciona sem abrir o drawer", async () => {
    const usuario = userEvent.setup();
    renderTabela();
    await screen.findByText("Maria Silva");

    await usuario.click(screen.getByRole("checkbox", { name: "Selecionar Maria Silva" }));

    expect(await screen.findByRole("region", { name: "Ações em lote" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desativar cliente" })).not.toBeInTheDocument();
  });

  it("mostra estado vazio quando não há clientes", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaListagem([]));
    renderTabela();

    expect(await screen.findByText("Nenhum cliente cadastrado ainda.")).toBeInTheDocument();
  });

  it("mostra erro quando a listagem falha", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Não foi possível listar os clientes." }),
    } as Response);
    renderTabela();

    expect(await screen.findByText("Não foi possível carregar os clientes.")).toBeInTheDocument();
  });

  it("a busca digitada vira parâmetro da consulta depois do debounce", async () => {
    const usuario = userEvent.setup();
    renderTabela();
    await screen.findByText("Maria Silva");

    await usuario.type(screen.getByRole("textbox", { name: "Buscar clientes" }), "joão");

    await waitFor(
      () => {
        const urls = (global.fetch as jest.Mock).mock.calls.map(([url]) => url as string);
        expect(urls.some((url) => url.includes("busca=jo"))).toBe(true);
      },
      { timeout: 2000 }
    );
  });
});
