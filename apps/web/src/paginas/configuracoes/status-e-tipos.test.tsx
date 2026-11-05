import { screen } from "@testing-library/react";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { renderPagina, SESSAO_OWNER, SESSAO_PADRAO } from "@/lib/test-paginas";
import { PaginaConfiguracoesStatus } from "./status";
import { PaginaConfiguracoesTiposProcesso } from "./tipos-processo";

jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));
jest.mock("@/components/configuracoes/status-table", () => ({
  StatusTable: ({ somenteLeitura }: { somenteLeitura: boolean }) => (
    <div data-testid="status" data-somente-leitura={String(somenteLeitura)} />
  ),
}));
jest.mock("@/components/configuracoes/tipo-processo-table", () => ({
  TipoProcessoTable: ({ somenteLeitura }: { somenteLeitura: boolean }) => (
    <div data-testid="tipos" data-somente-leitura={String(somenteLeitura)} />
  ),
}));

it.each([
  [SESSAO_OWNER, "false"],
  [SESSAO_PADRAO, "true"],
])("status do kanban em somente leitura conforme o papel (%#)", (sessao, esperado) => {
  renderPagina(<PaginaConfiguracoesStatus />, { sessao });
  expect(useTituloPagina).toHaveBeenCalledWith("Status do Kanban");
  expect(screen.getByTestId("status")).toHaveAttribute("data-somente-leitura", esperado);
});

it.each([
  [SESSAO_OWNER, "false"],
  [SESSAO_PADRAO, "true"],
])("tipos de processo em somente leitura conforme o papel (%#)", (sessao, esperado) => {
  renderPagina(<PaginaConfiguracoesTiposProcesso />, { sessao });
  expect(useTituloPagina).toHaveBeenCalledWith("Tipos de processo");
  expect(screen.getByTestId("tipos")).toHaveAttribute("data-somente-leitura", esperado);
});
