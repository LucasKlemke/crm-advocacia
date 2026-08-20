import { renderComQuery, screen, waitFor } from "@/lib/test-utils";
import userEvent from "@testing-library/user-event";
import { DashboardView } from "./dashboard-view";
import type { ResumoDashboardDTO } from "@/types/dashboard";

const RESUMO: ResumoDashboardDTO = {
  porTipoStatus: [
    {
      tipoStatus: {
        id: "tipo-1",
        chave: "contato",
        nome: "Contato",
        icone: "Phone",
        cor: "#f59e0b",
        descricao: null,
        ordem: 1,
      },
      total: 3,
      valorTotal: 4500,
    },
  ],
  porMes: [{ mes: "2026-08", total: 3 }],
  valorTotalAberto: 15000,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("DashboardView", () => {
  it("mostra um estado de carregamento antes da resposta", () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}));

    renderComQuery(
      <DashboardView atorUsuarioId="usuario-1" atorNome="Ana" atorRole="owner" />
    );

    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("mostra os cards e gráficos após carregar o resumo", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => RESUMO,
    } as Response);

    renderComQuery(
      <DashboardView atorUsuarioId="usuario-1" atorNome="Ana" atorRole="owner" />
    );

    await waitFor(() => expect(screen.getByText("Contato")).toBeInTheDocument());
    expect(screen.getByText("Valor total em aberto")).toBeInTheDocument();
    expect(screen.getByText("R$ 15.000,00")).toBeInTheDocument();
    expect(screen.getByText("Processos por status")).toBeInTheDocument();
    expect(screen.getByText("Processos criados nos últimos 6 meses")).toBeInTheDocument();
  });

  it("mostra uma mensagem de erro quando a busca falha", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Falhou" }),
    } as Response);

    renderComQuery(
      <DashboardView atorUsuarioId="usuario-1" atorNome="Ana" atorRole="owner" />
    );

    await waitFor(() =>
      expect(screen.getByText("Não foi possível carregar o painel.")).toBeInTheDocument()
    );
  });

  it("filtra a tabela de casos abaixo dos gráficos ao clicar em um card de status", async () => {
    let ultimaUrlCasos = "";
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.startsWith("/api/dashboard/resumo")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => RESUMO } as Response);
      }
      if (url.startsWith("/api/casos/filtros")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ clientes: [], membros: [], status: [], tipos: [] }),
        } as unknown as Response);
      }
      if (url.startsWith("/api/casos")) {
        ultimaUrlCasos = url;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ casos: [], total: 0, pagina: 1, porPagina: 20 }),
        } as unknown as Response);
      }
      return Promise.reject(new Error(`URL não mockada: ${url}`));
    });

    renderComQuery(
      <DashboardView atorUsuarioId="usuario-1" atorNome="Ana" atorRole="owner" />
    );

    await waitFor(() => expect(screen.getByText("Contato")).toBeInTheDocument());
    expect(ultimaUrlCasos).not.toContain("tipoStatusId=tipo-1");

    await userEvent.click(screen.getByRole("button", { name: /ver processos de contato/i }));

    expect(screen.getByText("Processos — Contato")).toBeInTheDocument();
    await waitFor(() => expect(ultimaUrlCasos).toContain("tipoStatusId=tipo-1"));

    await userEvent.click(screen.getByRole("button", { name: /limpar filtro/i }));
    expect(screen.queryByText("Processos — Contato")).not.toBeInTheDocument();
    await waitFor(() => expect(ultimaUrlCasos).not.toContain("tipoStatusId=tipo-1"));
  });

  it("aplica o filtro de responsável e cliente do topo a todo o painel, não só à tabela", async () => {
    let ultimaUrlCasos = "";
    let ultimaUrlResumo = "";
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.startsWith("/api/dashboard/resumo")) {
        ultimaUrlResumo = url;
        return Promise.resolve({ ok: true, status: 200, json: async () => RESUMO } as Response);
      }
      if (url.startsWith("/api/casos/filtros")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            clientes: [{ id: "cli-1", nome: "Maria Silva", cpf: "52998224725" }],
            membros: [{ id: "membro-1", nome: "João Souza" }],
            status: [],
            tipos: [],
          }),
        } as unknown as Response);
      }
      if (url.startsWith("/api/casos")) {
        ultimaUrlCasos = url;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ casos: [], total: 0, pagina: 1, porPagina: 20 }),
        } as unknown as Response);
      }
      return Promise.reject(new Error(`URL não mockada: ${url}`));
    });

    renderComQuery(
      <DashboardView atorUsuarioId="usuario-1" atorNome="Ana" atorRole="owner" />
    );

    await waitFor(() => expect(screen.getByText("Contato")).toBeInTheDocument());
    expect(ultimaUrlResumo).not.toContain("responsavelId");

    await userEvent.click(screen.getByRole("button", { name: "Responsável" }));
    await userEvent.click(await screen.findByText("João Souza"));
    await waitFor(() => expect(ultimaUrlCasos).toContain("responsavelId=membro-1"));
    await waitFor(() => expect(ultimaUrlResumo).toContain("responsavelId=membro-1"));

    await userEvent.click(screen.getByRole("button", { name: "Cliente" }));
    await userEvent.click(await screen.findByText("Maria Silva"));
    await waitFor(() => expect(ultimaUrlCasos).toContain("clienteId=cli-1"));
    await waitFor(() => expect(ultimaUrlResumo).toContain("clienteId=cli-1"));
  });
});
