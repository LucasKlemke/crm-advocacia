import userEvent from "@testing-library/user-event";
import { renderComQuery, screen, waitFor } from "@/lib/test-utils";
import { CasoForm } from "./caso-form";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

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
    if (url === "/api/casos" && init?.method === "POST") {
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({ caso: { id: "caso-novo", titulo: JSON.parse(String(init.body)).titulo } }),
      } as unknown as Response);
    }
    return Promise.reject(new Error(`URL não mockada: ${url}`));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockarFetch();
});

describe("CasoForm", () => {
  it("pré-seleciona o primeiro status (menor ordem) ao carregar as opções", async () => {
    renderComQuery(<CasoForm onSucesso={jest.fn()} />);

    expect(await screen.findByText("Em análise")).toBeInTheDocument();
  });

  it("mostra erro quando o título está vazio", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<CasoForm onSucesso={jest.fn()} />);
    await screen.findByText("Em análise");

    await usuario.click(screen.getByRole("button", { name: "Criar caso" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Informe o título do caso.");
  });

  it("mostra erro quando o cliente não foi selecionado", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<CasoForm onSucesso={jest.fn()} />);
    await screen.findByText("Em análise");

    await usuario.type(screen.getByLabelText(/Título/), "Ação de cobrança");
    await usuario.click(screen.getByRole("button", { name: "Criar caso" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Selecione o cliente.");
  });

  it("cria o caso com os dados preenchidos", async () => {
    const usuario = userEvent.setup();
    const onSucesso = jest.fn();
    renderComQuery(<CasoForm onSucesso={onSucesso} />);
    await screen.findByText("Em análise");

    await usuario.type(screen.getByLabelText(/Título/), "Ação de cobrança");

    await usuario.click(screen.getByRole("combobox", { name: /Cliente/ }));
    await usuario.click(await screen.findByRole("option", { name: "Maria Silva" }));

    await usuario.click(screen.getByRole("button", { name: "Criar caso" }));

    await waitFor(() => {
      const chamada = (global.fetch as jest.Mock).mock.calls.find(
        ([url, init]) => url === "/api/casos" && init?.method === "POST"
      );
      expect(chamada).toBeDefined();
      const corpo = JSON.parse(chamada[1].body);
      expect(corpo).toMatchObject({
        titulo: "Ação de cobrança",
        clienteId: "cli-1",
        statusId: "status-1",
        responsavelMembroId: null,
      });
    });
    await waitFor(() => expect(onSucesso).toHaveBeenCalled());
  });

  it("chama onCancelar ao clicar em Cancelar", async () => {
    const usuario = userEvent.setup();
    const onCancelar = jest.fn();
    renderComQuery(<CasoForm onSucesso={jest.fn()} onCancelar={onCancelar} />);
    await screen.findByText("Em análise");

    await usuario.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onCancelar).toHaveBeenCalled();
  });
});
