import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { useDashboardResumo } from "./use-dashboard";
import { filtrosDashboardPadrao } from "@/types/dashboard";
import type { ResumoDashboardDTO } from "@/types/dashboard";

function criarWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return { queryClient, Wrapper };
}

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
      valorTotal: 30000,
    },
  ],
  porMes: [{ mes: "2026-08", total: 3 }],
  valorTotalAberto: 15000,
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

describe("useDashboardResumo", () => {
  it("busca o resumo em /api/dashboard/resumo", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => RESUMO,
    } as Response);

    const { Wrapper } = criarWrapper();
    const { result } = renderHook(() => useDashboardResumo(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data).toEqual(RESUMO));
    expect(global.fetch).toHaveBeenCalledWith("/api/dashboard/resumo", expect.anything());
  });

  it("repassa cliente, responsável e período como query string", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => RESUMO,
    } as Response);

    const { Wrapper } = criarWrapper();
    const { result } = renderHook(
      () =>
        useDashboardResumo({
          ...filtrosDashboardPadrao,
          clienteIds: ["cli-1"],
          responsavelIds: ["membro-1"],
          dataInicio: "2026-01-01",
          dataFim: "2026-08-01",
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.data).toEqual(RESUMO));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/dashboard/resumo?clienteId=cli-1&responsavelId=membro-1&dataInicio=2026-01-01&dataFim=2026-08-01",
      expect.anything()
    );
  });
});
