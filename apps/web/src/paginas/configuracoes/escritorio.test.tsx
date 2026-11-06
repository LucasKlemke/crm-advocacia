import { screen, waitFor } from "@testing-library/react";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { chaveEscritorioAtual } from "@/hooks/use-escritorios";
import { mockApi, renderPagina, SESSAO_OWNER, SESSAO_PADRAO } from "@/lib/test-paginas";
import { PaginaConfiguracoesEscritorio } from "./escritorio";

jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));
jest.mock("@/components/configuracoes/escritorio-form", () => ({
  EscritorioForm: ({ escritorio, somenteLeitura }: { escritorio: { nome: string }; somenteLeitura: boolean }) => (
    <div data-testid="form" data-somente-leitura={String(somenteLeitura)}>
      {escritorio.nome}
    </div>
  ),
}));

const escritorio = { id: "esc-1", nome: "Escritório Um", oabResponsavel: "SC 71.025", telefoneWhatsapp: null };

function renderEscritorio(sessao: typeof SESSAO_OWNER | typeof SESSAO_PADRAO) {
  return renderPagina(<PaginaConfiguracoesEscritorio />, {
    rota: "/configuracoes/escritorio",
    caminho: "/configuracoes/escritorio",
    sessao,
  });
}

describe("PaginaConfiguracoesEscritorio", () => {
  it("carrega o escritório ativo e libera edição para owner", async () => {
    mockApi({ "/api/escritorios/atual": { escritorio } });
    renderEscritorio(SESSAO_OWNER);

    expect(useTituloPagina).toHaveBeenCalledWith("Escritório");
    expect(await screen.findByText("Escritório Um")).toBeInTheDocument();
    expect(screen.getByTestId("form")).toHaveAttribute("data-somente-leitura", "false");
    expect(screen.getByText(/aparecem nas mensagens e documentos/i)).toBeInTheDocument();
  });

  it("deixa o form em somente leitura para o papel padrao", async () => {
    mockApi({ "/api/escritorios/atual": { escritorio } });
    renderEscritorio(SESSAO_PADRAO);

    expect(await screen.findByTestId("form")).toHaveAttribute("data-somente-leitura", "true");
    expect(screen.getByText(/somente owners e admins podem editar/i)).toBeInTheDocument();
  });

  it("mostra erro quando o escritório não carrega", async () => {
    mockApi({ "/api/escritorios/atual": new Error("x") });
    renderEscritorio(SESSAO_OWNER);

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar o escritório.");
  });

  it("refetch que falha com dado em cache mantém o formulário montado", async () => {
    mockApi({ "/api/escritorios/atual": { escritorio } });
    const { queryClient } = renderEscritorio(SESSAO_OWNER);
    expect(await screen.findByTestId("form")).toBeInTheDocument();

    mockApi({ "/api/escritorios/atual": new Error("x") });
    await queryClient.refetchQueries({ queryKey: chaveEscritorioAtual() });

    await waitFor(() => expect(queryClient.getQueryState(chaveEscritorioAtual())?.status).toBe("error"));
    expect(screen.getByTestId("form")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
