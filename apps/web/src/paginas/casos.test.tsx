import { screen } from "@testing-library/react";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { renderPagina, SESSAO_PADRAO } from "@/lib/test-paginas";
import { PaginaCasos } from "./casos";

jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));
jest.mock("@/components/casos/casos-view", () => ({
  CasosView: (props: Record<string, string>) => <pre data-testid="view">{JSON.stringify(props)}</pre>,
}));

it("mostra o cabeçalho e passa o ator da sessão ao kanban/tabela", () => {
  renderPagina(<PaginaCasos />, { rota: "/casos", caminho: "/casos", sessao: SESSAO_PADRAO });

  expect(useTituloPagina).toHaveBeenCalledWith("Processos");
  expect(screen.getByRole("heading", { name: "Processos" })).toBeInTheDocument();
  expect(JSON.parse(screen.getByTestId("view").textContent ?? "{}")).toEqual({
    atorUsuarioId: "user-2",
    atorNome: "Colaborador Padrão",
    atorRole: "padrao",
  });
});
