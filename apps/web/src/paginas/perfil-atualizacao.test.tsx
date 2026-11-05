import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderPagina, respostaJson, SESSAO_OWNER } from "@/lib/test-paginas";
import { useSessao } from "@/lib/sessao";
import { PaginaPerfil } from "./perfil";

// Faz o papel do header do dashboard: observa a sessão e mostra o nome dela.
function NomeNoHeader() {
  return <p data-testid="header">{useSessao().data?.usuario.nome}</p>;
}

jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

// Formulários reais: o PATCH salva e o router.refresh() do compat precisa fazer a
// página (e a sessão, que alimenta o nome do header) mostrarem os dados novos.
describe("PaginaPerfil depois de salvar", () => {
  it("relê GET /api/perfil e GET /api/auth/sessao após o PATCH", async () => {
    let nomeNoBanco = "Nome Antigo";
    const chamadas: string[] = [];
    global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const chave = `${init?.method ?? "GET"} ${String(url)}`;
      chamadas.push(chave);
      if (chave === "PATCH /api/perfil") {
        nomeNoBanco = JSON.parse(String(init?.body)).nome;
        return respostaJson({ usuario: { id: "user-1", nome: nomeNoBanco } });
      }
      if (chave === "GET /api/perfil") {
        return respostaJson({
          usuario: {
            id: "user-1",
            nome: nomeNoBanco,
            email: "owner@teste.com",
            temAvatar: false,
          },
        });
      }
      if (chave === "GET /api/auth/sessao") {
        return respostaJson({
          ...SESSAO_OWNER,
          usuario: { ...SESSAO_OWNER.usuario, nome: nomeNoBanco },
        });
      }
      throw new Error(`fetch inesperado: ${chave}`);
    }) as jest.Mock;

    renderPagina(
      <>
        <NomeNoHeader />
        <PaginaPerfil />
      </>,
      { rota: "/perfil", caminho: "/perfil", sessao: SESSAO_OWNER },
    );
    const campoNome = await screen.findByLabelText("Nome");
    expect(campoNome).toHaveValue("Nome Antigo");

    await userEvent.clear(campoNome);
    await userEvent.type(campoNome, "Nome Novo");
    await userEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    // perfil relido (2 GETs) e sessão relida (o nome do header vem dela).
    await waitFor(() => expect(chamadas.filter((c) => c === "GET /api/perfil")).toHaveLength(2));
    await waitFor(() => expect(screen.getByTestId("header")).toHaveTextContent("Nome Novo"));
  });
});
