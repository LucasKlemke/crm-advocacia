import userEvent from "@testing-library/user-event";
import { renderComQuery, screen, waitFor } from "@/lib/test-utils";
import { TipoProcessoTable } from "./tipo-processo-table";
import type { TipoProcessoDTO } from "@/types/tipo-processo";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const TIPO_1: TipoProcessoDTO = {
  id: "tipo-processo-1",
  escritorioId: "esc-1",
  nome: "Juros abusivos",
  icone: "Briefcase",
  cor: "#6366f1",
  descricao: "Revisão de contrato com juros acima do praticado no mercado",
  ordem: 1,
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-01T12:00:00.000Z",
};

function mockFetch(tipos: TipoProcessoDTO[] = [TIPO_1]): typeof fetch {
  return jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/tipos-processo") {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ tipos }) } as Response);
    }
    if (url.startsWith("/api/tipos-processo/")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      } as Response);
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch();
});

describe("TipoProcessoTable", () => {
  it("lista o nome e a descrição de cada tipo", async () => {
    renderComQuery(<TipoProcessoTable somenteLeitura={false} />);

    expect(await screen.findByText("Juros abusivos")).toBeInTheDocument();
    expect(
      await screen.findByText("Revisão de contrato com juros acima do praticado no mercado")
    ).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há tipos", async () => {
    global.fetch = mockFetch([]);
    renderComQuery(<TipoProcessoTable somenteLeitura={false} />);

    expect(
      await screen.findByText("Nenhum tipo de processo cadastrado ainda.")
    ).toBeInTheDocument();
  });

  it("mostra as ações de escrita quando não é somente leitura", async () => {
    renderComQuery(<TipoProcessoTable somenteLeitura={false} />);
    await screen.findByText("Juros abusivos");

    expect(screen.getByRole("button", { name: "Novo tipo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar Juros abusivos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir Juros abusivos" })).toBeInTheDocument();
  });

  it("esconde as ações de escrita quando somenteLeitura é true (papel padrao)", async () => {
    renderComQuery(<TipoProcessoTable somenteLeitura />);
    await screen.findByText("Juros abusivos");

    expect(screen.queryByRole("button", { name: "Novo tipo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar Juros abusivos" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Excluir Juros abusivos" })
    ).not.toBeInTheDocument();
  });

  it("abre o formulário de edição preenchido ao clicar em editar", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<TipoProcessoTable somenteLeitura={false} />);
    await screen.findByText("Juros abusivos");

    await usuario.click(screen.getByRole("button", { name: "Editar Juros abusivos" }));

    expect(
      await screen.findByRole("heading", { name: "Editar tipo de processo" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("Juros abusivos");
  });

  it("exclui um tipo após confirmar no diálogo", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<TipoProcessoTable somenteLeitura={false} />);
    await screen.findByText("Juros abusivos");

    await usuario.click(screen.getByRole("button", { name: "Excluir Juros abusivos" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => {
      const chamada = (global.fetch as jest.Mock).mock.calls.find(
        ([url, init]) => url === "/api/tipos-processo/tipo-processo-1" && init?.method === "DELETE"
      );
      expect(chamada).toBeDefined();
    });
  });

  it("mostra a mensagem do servidor quando a exclusão falha (tipo com processos vinculados)", async () => {
    const { toast } = jest.requireMock("sonner") as { toast: { error: jest.Mock } };
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/tipos-processo" && init?.method !== "DELETE") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ tipos: [TIPO_1] }),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 409,
        json: async () => ({ error: "Este tipo tem processos vinculados e não pode ser excluído." }),
      } as Response);
    }) as typeof fetch;

    const usuario = userEvent.setup();
    renderComQuery(<TipoProcessoTable somenteLeitura={false} />);
    await screen.findByText("Juros abusivos");

    await usuario.click(screen.getByRole("button", { name: "Excluir Juros abusivos" }));
    await usuario.click(await screen.findByRole("button", { name: "Excluir" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Este tipo tem processos vinculados e não pode ser excluído."
      )
    );
  });
});
