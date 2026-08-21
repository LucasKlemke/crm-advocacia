import userEvent from "@testing-library/user-event";
import { renderComQuery, screen, waitFor } from "@/lib/test-utils";
import { CasosTable } from "./casos-table";
import { filtrosCasosPadrao } from "@/types/caso";
import type { CasoDTO } from "@/types/caso";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/components/shared/avatar-iniciais", () => ({
  AvatarIniciais: ({ nome, avatarUrl }: { nome: string; avatarUrl?: string | null }) => (
    <div data-testid={`avatar-${nome}`} data-avatar-url={avatarUrl ?? ""} />
  ),
}));

function casoFake(over: Partial<CasoDTO> = {}): CasoDTO {
  return {
    id: "caso-1",
    escritorioId: "esc-1",
    clienteId: "cli-1",
    statusId: "status-1",
    responsavelMembroId: null,
    titulo: "Ação de cobrança",
    numeroProcesso: null,
    descricao: null,
    valor: "1500.00",
    arquivado: false,
    createdAt: "2026-08-01T12:00:00.000Z",
    updatedAt: "2026-08-01T12:00:00.000Z",
    cliente: {
      id: "cli-1",
      nome: "Maria Silva",
      cpf: "52998224725",
      email: null,
      telefone: null,
      endereco: null,
      softDeletedAt: null,
      createdAt: "2026-08-01T12:00:00.000Z",
      updatedAt: "2026-08-01T12:00:00.000Z",
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
      createdAt: "2026-08-01T12:00:00.000Z",
      updatedAt: "2026-08-01T12:00:00.000Z",
    },
    responsavel: null,
    ...over,
  };
}

const CASO = casoFake();

function mockarFetch() {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (url.startsWith("/api/casos/filtros")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          clientes: [{ id: "cli-1", nome: "Maria Silva" }],
          membros: [
            { id: "membro-1", nome: "João Souza", avatarUrl: "https://bucket.s3.amazonaws.com/signed-get" },
          ],
          status: [
            { id: "status-1", nome: "Em análise", cor: "#f59e0b" },
            { id: "status-2", nome: "Fechado", cor: "#10b981" },
          ],
          tipos: [],
        }),
      } as unknown as Response);
    }
    if (url.startsWith("/api/casos")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ casos: [CASO], total: 1, pagina: 1, porPagina: 20 }),
      } as unknown as Response);
    }
    return Promise.reject(new Error(`URL não mockada: ${url}`));
  });
}

function renderTabela(onAbrirCaso = jest.fn()) {
  return renderComQuery(
    <CasosTable filtros={filtrosCasosPadrao} onFiltrosChange={jest.fn()} onAbrirCaso={onAbrirCaso} />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockarFetch();
});

describe("CasosTable", () => {
  it("lista os casos com cliente, status e valor formatado", async () => {
    renderTabela();

    expect(await screen.findByText("Ação de cobrança")).toBeInTheDocument();
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.500,00")).toBeInTheDocument();
  });

  it("mostra 'Sem responsável' quando o caso não tem responsável", async () => {
    renderTabela();

    expect(await screen.findByText("Sem responsável")).toBeInTheDocument();
  });

  it("abre o caso ao clicar no botão de ação da linha", async () => {
    const usuario = userEvent.setup();
    const onAbrirCaso = jest.fn();
    renderTabela(onAbrirCaso);
    await screen.findByText("Ação de cobrança");

    await usuario.click(screen.getByRole("button", { name: "Abrir Ação de cobrança" }));

    expect(onAbrirCaso).toHaveBeenCalledWith(expect.objectContaining({ id: "caso-1" }));
  });

  it("mostra estado vazio quando não há casos", async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.startsWith("/api/casos/filtros")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ clientes: [], membros: [], status: [], tipos: [] }),
        } as unknown as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ casos: [], total: 0, pagina: 1, porPagina: 20 }),
      } as unknown as Response);
    });
    renderTabela();

    expect(await screen.findByText("Nenhum processo cadastrado ainda.")).toBeInTheDocument();
  });

  it("troca o status do caso pelo select da linha", async () => {
    const usuario = userEvent.setup();
    renderTabela();
    await screen.findByText("Ação de cobrança");

    await usuario.click(screen.getByRole("combobox", { name: "Status de Ação de cobrança" }));
    await usuario.click(await screen.findByRole("option", { name: /Fechado/ }));

    await waitFor(() => {
      const chamada = (global.fetch as jest.Mock).mock.calls.find(
        ([url, init]) => url === "/api/casos/caso-1" && init?.method === "PATCH"
      );
      expect(chamada).toBeDefined();
      expect(JSON.parse(chamada[1].body)).toEqual({ statusId: "status-2" });
    });
  });

  it("repassa o avatarUrl do membro pro AvatarIniciais nas opções do select", async () => {
    const usuario = userEvent.setup();
    renderTabela();
    await screen.findByText("Ação de cobrança");

    await usuario.click(screen.getByRole("combobox", { name: "Responsável de Ação de cobrança" }));

    expect(await screen.findByTestId("avatar-João Souza")).toHaveAttribute(
      "data-avatar-url",
      "https://bucket.s3.amazonaws.com/signed-get"
    );
  });

  it("troca o responsável do caso pelo select da linha", async () => {
    const usuario = userEvent.setup();
    renderTabela();
    await screen.findByText("Ação de cobrança");

    await usuario.click(screen.getByRole("combobox", { name: "Responsável de Ação de cobrança" }));
    await usuario.click(await screen.findByRole("option", { name: /João Souza/ }));

    await waitFor(() => {
      const chamada = (global.fetch as jest.Mock).mock.calls.find(
        ([url, init]) => url === "/api/casos/caso-1" && init?.method === "PATCH"
      );
      expect(chamada).toBeDefined();
      expect(JSON.parse(chamada[1].body)).toEqual({ responsavelMembroId: "membro-1" });
    });
  });
});
