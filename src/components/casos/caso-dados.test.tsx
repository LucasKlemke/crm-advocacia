import userEvent from "@testing-library/user-event";
import { renderComQuery, screen, waitFor } from "@/lib/test-utils";
import { CasoDados } from "./caso-dados";
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
    if (url.startsWith("/api/casos/filtros")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          clientes: [{ id: "cli-1", nome: "Maria Silva" }],
          membros: [{ id: "membro-1", nome: "Ana Advogada" }],
          status: [
            { id: "status-1", nome: "Em análise", cor: "#f59e0b" },
            { id: "status-2", nome: "Fechado", cor: "#10b981" },
          ],
          tipos: [],
        }),
      } as unknown as Response);
    }
    if (url === "/api/casos/caso-1" && init?.method === "PATCH") {
      const dados = JSON.parse(String(init.body));
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ caso: { ...casoFake(), ...dados } }),
      } as unknown as Response);
    }
    return Promise.reject(new Error(`URL não mockada: ${url}`));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockarFetch();
});

describe("CasoDados", () => {
  it("mostra os dados atuais do caso", async () => {
    renderComQuery(<CasoDados caso={casoFake()} />);

    expect(screen.getByDisplayValue("Ação de cobrança")).toBeInTheDocument();
  });

  it("troca o status e salva imediatamente", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<CasoDados caso={casoFake()} />);
    await screen.findByText("Em análise");

    await usuario.click(screen.getByRole("combobox", { name: "Status" }));
    await usuario.click(await screen.findByRole("option", { name: /Fechado/ }));

    await waitFor(() => {
      const chamada = (global.fetch as jest.Mock).mock.calls.find(
        ([url, init]) => url === "/api/casos/caso-1" && init?.method === "PATCH"
      );
      expect(chamada).toBeDefined();
      expect(JSON.parse(chamada[1].body)).toEqual({ statusId: "status-2" });
    });
  });

  it("só mostra o botão salvar quando o título/valor/descrição muda", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<CasoDados caso={casoFake()} />);
    await screen.findByText("Em análise");

    expect(screen.queryByRole("button", { name: "Salvar alterações" })).not.toBeInTheDocument();

    await usuario.type(screen.getByDisplayValue("Ação de cobrança"), " urgente");

    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeInTheDocument();
  });

  it("salva o título editado ao clicar em Salvar alterações", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<CasoDados caso={casoFake()} />);
    await screen.findByText("Em análise");

    const campo = screen.getByDisplayValue("Ação de cobrança");
    await usuario.clear(campo);
    await usuario.type(campo, "Novo título");
    await usuario.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      const chamada = (global.fetch as jest.Mock).mock.calls.find(
        ([url, init]) => url === "/api/casos/caso-1" && init?.method === "PATCH"
      );
      expect(chamada).toBeDefined();
      expect(JSON.parse(chamada[1].body)).toMatchObject({ titulo: "Novo título" });
    });
  });
});
