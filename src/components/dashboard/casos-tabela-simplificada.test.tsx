import { renderComQuery, screen, waitFor } from "@/lib/test-utils";
import userEvent from "@testing-library/user-event";
import { CasosTabelaSimplificada } from "./casos-tabela-simplificada";
import { filtrosCasosPadrao } from "@/types/caso";
import type { ListaCasos } from "@/types/caso";

const ATOR = { atorUsuarioId: "usr-1", atorNome: "Ana", atorRole: "owner" as const };

const LISTA: ListaCasos = {
  casos: [
    {
      id: "caso-1",
      escritorioId: "esc-1",
      clienteId: "cli-1",
      statusId: "status-1",
      responsavelMembroId: null,
      titulo: "Ação de cobrança",
      numeroProcesso: "0001234-56.2026.8.24.0000",
      descricao: null,
      valor: 5000,
      arquivado: false,
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-10T10:00:00.000Z",
      cliente: {
        id: "cli-1",
        nome: "Maria Silva",
        cpf: "52998224725",
        email: null,
        telefone: null,
        endereco: null,
        softDeletedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      status: {
        id: "status-1",
        escritorioId: "esc-1",
        tipoStatusId: "tipo-1",
        nome: "Em análise",
        icone: "Search",
        cor: "#f59e0b",
        descricao: null,
        ordem: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      responsavel: null,
    },
  ],
  total: 1,
  pagina: 1,
  porPagina: 20,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("CasosTabelaSimplificada", () => {
  it("mostra nº do processo, cliente, status, valor e atualizado em", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => LISTA,
    } as Response);

    renderComQuery(<CasosTabelaSimplificada filtros={filtrosCasosPadrao} {...ATOR} />);

    await waitFor(() => expect(screen.getByText("Maria Silva")).toBeInTheDocument());
    expect(screen.getByText("0001234-56.2026.8.24.0000")).toBeInTheDocument();
    expect(screen.getByText("Em análise")).toBeInTheDocument();
    expect(screen.getByText("R$ 5.000,00")).toBeInTheDocument();
  });

  it("mostra mensagem de vazio quando não há processos", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ casos: [], total: 0, pagina: 1, porPagina: 20 }),
    } as Response);

    renderComQuery(<CasosTabelaSimplificada filtros={filtrosCasosPadrao} {...ATOR} />);

    await waitFor(() =>
      expect(screen.getByText("Nenhum processo cadastrado ainda.")).toBeInTheDocument()
    );
  });

  it("mostra mensagem de erro quando a busca falha", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Falhou" }),
    } as Response);

    renderComQuery(<CasosTabelaSimplificada filtros={filtrosCasosPadrao} {...ATOR} />);

    await waitFor(() =>
      expect(screen.getByText("Não foi possível carregar os processos.")).toBeInTheDocument()
    );
  });

  it("abre a drawer com os detalhes do processo ao clicar na linha", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => LISTA,
    } as Response);

    renderComQuery(<CasosTabelaSimplificada filtros={filtrosCasosPadrao} {...ATOR} />);

    await waitFor(() => expect(screen.getByText("Maria Silva")).toBeInTheDocument());

    await userEvent.click(screen.getByText("Maria Silva"));

    expect(await screen.findByRole("heading", { name: "Ação de cobrança" })).toBeInTheDocument();
  });
});
