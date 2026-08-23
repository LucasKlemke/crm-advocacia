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
    tipoProcessoId: "tipo-processo-1",
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
    tipoProcesso: {
      id: "tipo-processo-1",
      escritorioId: "esc-1",
      nome: "Ação de cobrança",
      icone: "Briefcase",
      cor: "#6366f1",
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
          tiposProcesso: [
            { id: "tipo-processo-1", nome: "Ação de cobrança", cor: "#6366f1", icone: "Briefcase" },
            { id: "tipo-processo-2", nome: "Divórcio", cor: "#f43f5e", icone: "Users" },
          ],
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

    expect(
      await screen.findByRole("combobox", { name: /Tipo de processo/ })
    ).toHaveTextContent("Ação de cobrança");
  });

  it("troca o tipo de processo e salva imediatamente", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<CasoDados caso={casoFake()} />);
    await screen.findByText("Em análise");

    await usuario.click(screen.getByRole("combobox", { name: /Tipo de processo/ }));
    await usuario.click(await screen.findByRole("option", { name: /Divórcio/ }));

    await waitFor(() => {
      const chamada = (global.fetch as jest.Mock).mock.calls.find(
        ([url, init]) => url === "/api/casos/caso-1" && init?.method === "PATCH"
      );
      expect(chamada).toBeDefined();
      expect(JSON.parse(chamada[1].body)).toEqual({ tipoProcessoId: "tipo-processo-2" });
    });
  });

  it("não oferece o atalho de criar tipo para o papel padrao", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<CasoDados caso={casoFake()} atorRole="padrao" />);
    await screen.findByText("Em análise");

    await usuario.click(screen.getByRole("combobox", { name: /Tipo de processo/ }));

    expect(await screen.findByRole("option", { name: /Divórcio/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Criar tipo/ })).not.toBeInTheDocument();
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

  it("só mostra o botão salvar quando nº/valor/descrição muda", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<CasoDados caso={casoFake()} />);
    await screen.findByText("Em análise");

    expect(screen.queryByRole("button", { name: "Salvar alterações" })).not.toBeInTheDocument();

    await usuario.type(screen.getByLabelText(/Nº do processo/), "0001");

    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeInTheDocument();
  });

  it("salva o nº do processo editado ao clicar em Salvar alterações", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<CasoDados caso={casoFake()} />);
    await screen.findByText("Em análise");

    const campo = screen.getByLabelText(/Nº do processo/);
    await usuario.clear(campo);
    await usuario.type(campo, "0001112-33.2026.8.24.0001");
    await usuario.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      const chamada = (global.fetch as jest.Mock).mock.calls.find(
        ([url, init]) => url === "/api/casos/caso-1" && init?.method === "PATCH"
      );
      expect(chamada).toBeDefined();
      expect(JSON.parse(chamada[1].body)).toMatchObject({
        numeroProcesso: "0001112-33.2026.8.24.0001",
      });
    });
  });
});
