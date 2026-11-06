import { screen } from "@testing-library/react";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { renderPagina, SESSAO_OWNER, SESSAO_PADRAO } from "@/lib/test-paginas";
import { PaginaCampanhas } from "./lista";
import { PaginaNovaCampanha } from "./nova";
import { PaginaCampanha } from "./detalhe";

jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));
jest.mock("./_components/lista-campanhas", () => ({
  ListaCampanhas: ({ somenteLeitura }: { somenteLeitura: boolean }) => (
    <div data-testid="lista" data-somente-leitura={String(somenteLeitura)} />
  ),
}));
jest.mock("./nova/_components/formulario-campanha", () => ({
  FormularioCampanha: () => <div data-testid="formulario" />,
}));
jest.mock("./detalhe/_components/detalhe-campanha", () => ({
  DetalheCampanha: ({ campanhaId, somenteLeitura }: { campanhaId: string; somenteLeitura: boolean }) => (
    <div data-testid="detalhe" data-id={campanhaId} data-somente-leitura={String(somenteLeitura)} />
  ),
}));

describe("PaginaCampanhas", () => {
  it.each([
    ["owner", SESSAO_OWNER, "false"],
    ["padrao", SESSAO_PADRAO, "true"],
  ])("lista em modo somente leitura conforme o papel (%s)", (_papel, sessao, esperado) => {
    renderPagina(<PaginaCampanhas />, { rota: "/campanhas", caminho: "/campanhas", sessao });
    expect(useTituloPagina).toHaveBeenCalledWith("Campanhas");
    expect(screen.getByTestId("lista")).toHaveAttribute("data-somente-leitura", esperado);
  });
});

describe("PaginaNovaCampanha", () => {
  it("mostra o formulário para owner/admin", () => {
    renderPagina(<PaginaNovaCampanha />, { rota: "/campanhas/nova", caminho: "/campanhas/nova", sessao: SESSAO_OWNER });
    expect(useTituloPagina).toHaveBeenCalledWith("Nova campanha");
    expect(screen.getByTestId("formulario")).toBeInTheDocument();
  });

  it("devolve o papel padrao para a lista sem montar o formulário", () => {
    renderPagina(<PaginaNovaCampanha />, {
      rota: "/campanhas/nova",
      caminho: "/campanhas/nova",
      sessao: SESSAO_PADRAO,
      outras: [["/campanhas", <p key="l">lista de campanhas</p>]],
    });
    expect(screen.getByText("lista de campanhas")).toBeInTheDocument();
    expect(screen.queryByTestId("formulario")).not.toBeInTheDocument();
  });
});

describe("PaginaCampanha", () => {
  it("lê o id da URL e aplica somente leitura ao papel padrao", () => {
    renderPagina(<PaginaCampanha />, { rota: "/campanhas/camp-42", caminho: "/campanhas/:id", sessao: SESSAO_PADRAO });
    expect(useTituloPagina).toHaveBeenCalledWith("Campanha");
    expect(screen.getByTestId("detalhe")).toHaveAttribute("data-id", "camp-42");
    expect(screen.getByTestId("detalhe")).toHaveAttribute("data-somente-leitura", "true");
  });

  it("não aplica somente leitura ao owner", () => {
    renderPagina(<PaginaCampanha />, { rota: "/campanhas/outro-id", caminho: "/campanhas/:id", sessao: SESSAO_OWNER });
    expect(screen.getByTestId("detalhe")).toHaveAttribute("data-id", "outro-id");
    expect(screen.getByTestId("detalhe")).toHaveAttribute("data-somente-leitura", "false");
  });
});
