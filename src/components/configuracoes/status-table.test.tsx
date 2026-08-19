import userEvent from "@testing-library/user-event";
import { renderComQuery, screen, waitFor } from "@/lib/test-utils";
import { StatusTable } from "./status-table";
import type { StatusDTO, TipoStatusDTO } from "@/types/status";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const TIPO_ANALISE: TipoStatusDTO = {
  id: "tipo-analise",
  chave: "analise",
  nome: "Análise",
  icone: "Search",
  cor: "#f59e0b",
  descricao: null,
  ordem: 2,
};

const STATUS_1: StatusDTO = {
  id: "status-1",
  escritorioId: "esc-1",
  tipoStatusId: "tipo-analise",
  nome: "Em análise",
  icone: "Search",
  cor: "#f59e0b",
  descricao: "Contato inicial recebido",
  ordem: 1,
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-01T12:00:00.000Z",
};

function mockFetch(status: StatusDTO[] = [STATUS_1]): typeof fetch {
  return jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/status") {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ status }),
      } as Response);
    }
    if (url === "/api/tipos-status") {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ tipos: [TIPO_ANALISE] }),
      } as Response);
    }
    if (url.startsWith("/api/status/") && url !== "/api/status") {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) } as Response);
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch();
});

describe("StatusTable", () => {
  it("lista o nome, tipo e descrição de cada status", async () => {
    renderComQuery(<StatusTable somenteLeitura={false} />);

    expect(await screen.findByText("Em análise")).toBeInTheDocument();
    expect(await screen.findByText("Contato inicial recebido")).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há status", async () => {
    global.fetch = mockFetch([]);
    renderComQuery(<StatusTable somenteLeitura={false} />);

    expect(await screen.findByText("Nenhum status cadastrado ainda.")).toBeInTheDocument();
  });

  it('mostra o botão "Novo status" e as ações de editar/excluir quando não é somente leitura', async () => {
    renderComQuery(<StatusTable somenteLeitura={false} />);
    await screen.findByText("Em análise");

    expect(screen.getByRole("button", { name: "Novo status" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar Em análise" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir Em análise" })).toBeInTheDocument();
  });

  it("esconde as ações de escrita quando somenteLeitura é true", async () => {
    renderComQuery(<StatusTable somenteLeitura />);
    await screen.findByText("Em análise");

    expect(screen.queryByRole("button", { name: "Novo status" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar Em análise" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir Em análise" })).not.toBeInTheDocument();
  });

  it("abre o formulário de edição preenchido ao clicar em editar", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<StatusTable somenteLeitura={false} />);
    await screen.findByText("Em análise");

    await usuario.click(screen.getByRole("button", { name: "Editar Em análise" }));

    expect(await screen.findByRole("heading", { name: "Editar status" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("Em análise");
  });

  it("exclui um status após confirmar no diálogo", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<StatusTable somenteLeitura={false} />);
    await screen.findByText("Em análise");

    await usuario.click(screen.getByRole("button", { name: "Excluir Em análise" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => {
      const chamada = (global.fetch as jest.Mock).mock.calls.find(
        ([url, init]) => url === "/api/status/status-1" && init?.method === "DELETE"
      );
      expect(chamada).toBeDefined();
    });
  });

  it("mostra a mensagem de erro do servidor quando a exclusão falha (status com casos vinculados)", async () => {
    const { toast } = jest.requireMock("sonner") as { toast: { error: jest.Mock } };
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/status") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ status: [STATUS_1] }),
        } as Response);
      }
      if (url === "/api/tipos-status") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ tipos: [TIPO_ANALISE] }),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 409,
        json: async () => ({ error: "Este status tem casos vinculados e não pode ser excluído." }),
      } as Response);
    });

    const usuario = userEvent.setup();
    renderComQuery(<StatusTable somenteLeitura={false} />);
    await screen.findByText("Em análise");

    await usuario.click(screen.getByRole("button", { name: "Excluir Em análise" }));
    await usuario.click(await screen.findByRole("button", { name: "Excluir" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Este status tem casos vinculados e não pode ser excluído."
      )
    );
  });
});
