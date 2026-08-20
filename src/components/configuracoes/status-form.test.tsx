import userEvent from "@testing-library/user-event";
import { renderComQuery, screen, waitFor } from "@/lib/test-utils";
import { StatusForm } from "./status-form";
import type { StatusDTO, TipoStatusDTO } from "@/types/status";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const TIPO_ANALISE: TipoStatusDTO = {
  id: "tipo-analise",
  chave: "analise",
  nome: "Em análise",
  icone: "Search",
  cor: "#f59e0b",
  descricao: null,
  ordem: 2,
};

const TIPO_QUALIFICADO: TipoStatusDTO = {
  id: "tipo-qualificado",
  chave: "qualificado",
  nome: "Qualificado",
  icone: "CircleCheck",
  cor: "#0ea5e9",
  descricao: null,
  ordem: 3,
};

const STATUS: StatusDTO = {
  id: "status-1",
  escritorioId: "esc-1",
  tipoStatusId: "tipo-analise",
  nome: "Em análise",
  icone: "Search",
  cor: "#f59e0b",
  descricao: null,
  ordem: 1,
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-01T12:00:00.000Z",
};

function mockFetch(): typeof fetch {
  return jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/tipos-status") {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ tipos: [TIPO_ANALISE, TIPO_QUALIFICADO] }),
      } as Response);
    }
    if (url === "/api/status" && init?.method === "POST") {
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({ status: STATUS }),
      } as Response);
    }
    if (url === "/api/status/status-1" && init?.method === "PATCH") {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ status: { ...STATUS, nome: "Novo nome" } }),
      } as Response);
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch();
});

describe("StatusForm", () => {
  it("cria um status com nome, tipo, ícone e cor e avisa o chamador", async () => {
    const usuario = userEvent.setup();
    const onSucesso = jest.fn();

    renderComQuery(<StatusForm onSucesso={onSucesso} />);

    await usuario.type(screen.getByLabelText("Nome"), "Em análise");

    await usuario.click(screen.getByLabelText("Tipo de status"));
    await usuario.click(await screen.findByRole("option", { name: "Em análise" }));

    await usuario.click(screen.getByRole("button", { name: "Selecionar ícone" }));
    await usuario.click(await screen.findByText("Search"));

    await usuario.click(screen.getByRole("radio", { name: "Cor #f59e0b" }));

    await usuario.click(screen.getByRole("button", { name: "Criar status" }));

    await waitFor(() => expect(onSucesso).toHaveBeenCalledWith(STATUS));
    const chamada = (global.fetch as jest.Mock).mock.calls.find(
      ([url]) => url === "/api/status"
    );
    expect(JSON.parse(chamada[1].body)).toMatchObject({
      nome: "Em análise",
      tipoStatusId: "tipo-analise",
      icone: "Search",
      cor: "#f59e0b",
    });
  });

  it("bloqueia o envio sem selecionar tipo/ícone/cor", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<StatusForm onSucesso={jest.fn()} />);

    await usuario.type(screen.getByLabelText("Nome"), "Em análise");
    await usuario.click(screen.getByRole("button", { name: "Criar status" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Selecione o tipo de status.");
    const chamadaStatus = (global.fetch as jest.Mock).mock.calls.find(
      ([url]) => url === "/api/status"
    );
    expect(chamadaStatus).toBeUndefined();
  });

  it("no modo edição preenche os campos e envia PATCH", async () => {
    const usuario = userEvent.setup();
    renderComQuery(<StatusForm status={STATUS} onSucesso={jest.fn()} />);

    expect(screen.getByLabelText("Nome")).toHaveValue("Em análise");

    await usuario.clear(screen.getByLabelText("Nome"));
    await usuario.type(screen.getByLabelText("Nome"), "Novo nome");
    await usuario.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      const chamada = (global.fetch as jest.Mock).mock.calls.find(
        ([url]) => url === "/api/status/status-1"
      );
      expect(chamada).toBeDefined();
      expect(chamada[1].method).toBe("PATCH");
      expect(JSON.parse(chamada[1].body).nome).toBe("Novo nome");
    });
  });

  it("mostra a mensagem de erro do servidor ao falhar", async () => {
    (global.fetch as jest.Mock) = jest.fn((url: string) => {
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
        json: async () => ({ error: "Já existe um status com este nome neste escritório." }),
      } as Response);
    });

    const usuario = userEvent.setup();
    renderComQuery(<StatusForm onSucesso={jest.fn()} />);

    await usuario.type(screen.getByLabelText("Nome"), "Em análise");
    await usuario.click(screen.getByLabelText("Tipo de status"));
    await usuario.click(await screen.findByRole("option", { name: "Em análise" }));
    await usuario.click(screen.getByRole("button", { name: "Selecionar ícone" }));
    await usuario.click(await screen.findByText("Search"));
    await usuario.click(screen.getByRole("radio", { name: "Cor #f59e0b" }));

    await usuario.click(screen.getByRole("button", { name: "Criar status" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Já existe um status com este nome neste escritório."
    );
  });
});
