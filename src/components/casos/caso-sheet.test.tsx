import userEvent from "@testing-library/user-event";
import { renderComQuery, screen, waitFor } from "@/lib/test-utils";
import { CasoSheet } from "./caso-sheet";
import type { CasoDTO } from "@/types/caso";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

function casoFake(over: Partial<CasoDTO> = {}): CasoDTO {
  return {
    id: "caso-1",
    escritorioId: "esc-1",
    clienteId: "cli-1",
    statusId: "status-1",
    responsavelMembroId: null,
    titulo: "Ação de cobrança",
    descricao: null,
    valor: null,
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

function mockarFetch() {
  global.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url.startsWith("/api/comentarios")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ comentarios: [] }),
      } as unknown as Response);
    }
    if (url.startsWith("/api/casos/filtros")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          clientes: [{ id: "cli-1", nome: "Maria Silva" }],
          membros: [],
          status: [{ id: "status-1", nome: "Em análise", cor: "#f59e0b" }],
          tipos: [],
        }),
      } as unknown as Response);
    }
    if (url === "/api/casos/caso-1" && init?.method === "DELETE") {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ caso: { ...casoFake(), arquivado: true } }),
      } as unknown as Response);
    }
    return Promise.reject(new Error(`URL não mockada: ${url}`));
  });
}

function renderSheet(props: Partial<React.ComponentProps<typeof CasoSheet>> = {}) {
  return renderComQuery(
    <CasoSheet
      modo={props.modo ?? "ver"}
      caso={props.caso ?? casoFake()}
      aberto
      onOpenChange={props.onOpenChange ?? jest.fn()}
      atorUsuarioId="user-1"
      atorNome="Ana Titular"
      atorRole="owner"
    />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockarFetch();
});

describe("CasoSheet", () => {
  it("mostra o título do caso e o formulário de dados no modo ver", async () => {
    renderSheet();

    expect(await screen.findByRole("heading", { name: /Ação de cobrança/ })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ação de cobrança")).toBeInTheDocument();
  });

  it("mostra o formulário de criação no modo criar", async () => {
    renderSheet({ modo: "criar", caso: null });

    expect(await screen.findByRole("heading", { name: "Novo caso" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar caso" })).toBeInTheDocument();
  });

  it("mostra o selo Arquivado e esconde o botão de arquivar quando o caso já está arquivado", async () => {
    renderSheet({ caso: casoFake({ arquivado: true }) });

    expect(await screen.findByText("Arquivado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Arquivar caso" })).not.toBeInTheDocument();
  });

  it("arquiva o caso ao clicar em Arquivar caso", async () => {
    const usuario = userEvent.setup();
    const onOpenChange = jest.fn();
    renderSheet({ onOpenChange });
    await screen.findByDisplayValue("Ação de cobrança");

    await usuario.click(screen.getByRole("button", { name: "Arquivar caso" }));

    await waitFor(() => {
      const chamada = (global.fetch as jest.Mock).mock.calls.find(
        ([url, init]) => url === "/api/casos/caso-1" && init?.method === "DELETE"
      );
      expect(chamada).toBeDefined();
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
