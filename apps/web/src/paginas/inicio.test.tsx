import { screen } from "@testing-library/react";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { renderPagina, SESSAO_PADRAO } from "@/lib/test-paginas";
import { formatarDataExtensa } from "@/lib/utils/data";
import { PaginaInicio } from "./inicio";

jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));
jest.mock("@/components/dashboard/dashboard-view", () => ({
  DashboardView: (props: Record<string, string>) => <pre data-testid="view">{JSON.stringify(props)}</pre>,
}));

it("monta o dashboard com o ator da sessão e a data de hoje", () => {
  renderPagina(<PaginaInicio />, { sessao: SESSAO_PADRAO });

  expect(useTituloPagina).toHaveBeenCalledWith("Dashboard");
  expect(JSON.parse(screen.getByTestId("view").textContent ?? "{}")).toEqual({
    atorUsuarioId: "user-2",
    atorNome: "Colaborador Padrão",
    atorRole: "padrao",
    dataHoje: formatarDataExtensa(new Date()),
  });
});
