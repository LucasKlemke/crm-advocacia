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
    numeroProcesso: null,
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
    if (url.startsWith("/api/documentos")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ documentos: [] }),
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

    expect(await screen.findByRole("heading", { name: "Novo processo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar processo" })).toBeInTheDocument();
  });

  it("mostra o selo Arquivado e esconde o botão de arquivar quando o caso já está arquivado", async () => {
    renderSheet({ caso: casoFake({ arquivado: true }) });

    expect(await screen.findByText("Arquivado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Arquivar processo" })).not.toBeInTheDocument();
  });

  it("arquiva o caso ao clicar em Arquivar caso", async () => {
    const usuario = userEvent.setup();
    const onOpenChange = jest.fn();
    renderSheet({ onOpenChange });
    await screen.findByDisplayValue("Ação de cobrança");

    await usuario.click(screen.getByRole("button", { name: "Arquivar processo" }));

    await waitFor(() => {
      const chamada = (global.fetch as jest.Mock).mock.calls.find(
        ([url, init]) => url === "/api/casos/caso-1" && init?.method === "DELETE"
      );
      expect(chamada).toBeDefined();
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("mostra as abas Detalhes/Documentos no modo ver, mas não no modo criar", async () => {
    renderSheet();
    expect(await screen.findByRole("tab", { name: "Detalhes" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Documentos" })).toBeInTheDocument();
  });

  it("não mostra abas no modo criar", async () => {
    renderSheet({ modo: "criar", caso: null });
    await screen.findByRole("heading", { name: "Novo processo" });
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("mostra os documentos do processo e do cliente ao trocar para a aba Documentos", async () => {
    const usuario = userEvent.setup();
    renderSheet();

    await usuario.click(await screen.findByRole("tab", { name: "Documentos" }));

    expect(await screen.findByText("Documentos do processo")).toBeInTheDocument();
    expect(screen.getByText("Documentos do cliente")).toBeInTheDocument();
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/documentos?escopo=caso&escopoId=caso-1",
        expect.anything()
      )
    );
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/documentos?escopo=cliente&escopoId=cli-1",
        expect.anything()
      )
    );
  });

  // Clicar num documento troca o conteúdo da drawer inteira pelo visualizador (como uma
  // aba exclusiva), escondendo as abas Detalhes/Documentos até voltar.
  it("abre o documento na própria drawer ao clicar no card, e Voltar restaura as abas", async () => {
    global.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.startsWith("/api/comentarios")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ comentarios: [] }) } as Response);
      }
      if (url.startsWith("/api/casos/filtros")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ clientes: [], membros: [], status: [], tipos: [] }),
        } as Response);
      }
      if (url === "/api/documentos?escopo=caso&escopoId=caso-1") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            documentos: [
              {
                id: "doc-1",
                escopo: "caso",
                escopoId: "caso-1",
                nomeOriginal: "contrato.pdf",
                tipoArquivo: "pdf",
                tamanhoKb: 100,
                createdAt: "2026-08-01T12:00:00.000Z",
              },
            ],
          }),
        } as Response);
      }
      if (url.startsWith("/api/documentos?escopo=cliente")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ documentos: [] }) } as Response);
      }
      if (url.includes("download-url")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ downloadUrl: "https://s3.example.com/get-inline" }),
        } as Response);
      }
      return Promise.reject(new Error(`URL não mockada: ${url}`));
    });

    const usuario = userEvent.setup();
    renderSheet();

    await usuario.click(await screen.findByRole("tab", { name: "Documentos" }));
    await usuario.click(await screen.findByRole("button", { name: /^contrato\.pdf/i }));

    expect(await screen.findByRole("button", { name: "Voltar" })).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    await screen.findByTitle("contrato.pdf");

    await usuario.click(screen.getByRole("button", { name: "Voltar" }));

    // Voltar reabre na aba Documentos (de onde o clique partiu), não em Detalhes.
    expect(await screen.findByRole("tab", { name: "Documentos" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText("Documentos do processo")).toBeInTheDocument();
  });
});
