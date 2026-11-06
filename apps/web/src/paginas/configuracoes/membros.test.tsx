import { screen, waitFor } from "@testing-library/react";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { chaveMembros } from "@/hooks/use-membros";
import { mockApi, renderPagina, SESSAO_OWNER, SESSAO_PADRAO } from "@/lib/test-paginas";
import { PaginaConfiguracoesMembros } from "./membros";

jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));
jest.mock("@/components/configuracoes/membros-table", () => ({
  MembrosTable: ({
    membros,
    atorUsuarioId,
    atorRole,
  }: {
    membros: { usuario: { nome: string; avatarUrl?: string | null } }[];
    atorUsuarioId: string;
    atorRole: string;
  }) => (
    <div data-testid="membros-table" data-ator={atorUsuarioId} data-role={atorRole}>
      {membros.map((m) => (
        <span key={m.usuario.nome} data-avatar-url={m.usuario.avatarUrl ?? ""}>
          {m.usuario.nome}
        </span>
      ))}
    </div>
  ),
}));
jest.mock("@/components/configuracoes/convites-table", () => ({
  ConvitesTable: ({ convites }: { convites: { email: string }[] }) => (
    <ul aria-label="convites">
      {convites.map((c) => (
        <li key={c.email}>{c.email}</li>
      ))}
    </ul>
  ),
}));
jest.mock("@/components/configuracoes/novo-membro-drawer", () => ({
  NovoMembroDrawer: () => <button type="button">Novo membro</button>,
}));

const membro = {
  id: "membro-1",
  role: "owner",
  usuario: {
    id: "user-1",
    nome: "Dona Owner",
    email: "owner@teste.com",
    telefone: null,
    avatarUrl: "https://bucket.s3.amazonaws.com/signed-get",
  },
};

function renderMembros(sessao: typeof SESSAO_OWNER | typeof SESSAO_PADRAO) {
  return renderPagina(<PaginaConfiguracoesMembros />, {
    rota: "/configuracoes/membros",
    caminho: "/configuracoes/membros",
    sessao,
  });
}

beforeEach(() => jest.clearAllMocks());

describe("PaginaConfiguracoesMembros", () => {
  it("passa à tabela os membros com o avatar já assinado pela API", async () => {
    mockApi({ "/api/membros": { membros: [membro] }, "/api/convites": { convites: [] } });
    renderMembros(SESSAO_OWNER);

    expect(useTituloPagina).toHaveBeenCalledWith("Membros");
    expect(await screen.findByText("Dona Owner")).toHaveAttribute(
      "data-avatar-url",
      "https://bucket.s3.amazonaws.com/signed-get"
    );
    expect(screen.getByTestId("membros-table")).toHaveAttribute("data-ator", "user-1");
    expect(screen.getByRole("button", { name: "Novo membro" })).toBeInTheDocument();
  });

  it("mostra os convites pendentes para quem gerencia membros", async () => {
    mockApi({
      "/api/membros": { membros: [membro] },
      "/api/convites": { convites: [{ id: "c1", email: "novo@teste.com", role: "padrao" }] },
    });
    renderMembros(SESSAO_OWNER);

    expect(await screen.findByRole("list", { name: "convites" })).toHaveTextContent("novo@teste.com");
  });

  it("papel padrao não busca convites nem vê o botão de novo membro", async () => {
    mockApi({ "/api/membros": { membros: [membro] } });
    renderMembros(SESSAO_PADRAO);

    expect(await screen.findByText("Dona Owner")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalledWith("/api/convites", expect.anything());
    expect(screen.queryByRole("button", { name: "Novo membro" })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "convites" })).not.toBeInTheDocument();
  });

  it("mostra erro quando a lista de membros não carrega", async () => {
    mockApi({ "/api/membros": new Error("x"), "/api/convites": { convites: [] } });
    renderMembros(SESSAO_OWNER);

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar os membros.");
  });

  it("refetch que falha com dado em cache mantém a tabela montada", async () => {
    mockApi({ "/api/membros": { membros: [membro] }, "/api/convites": { convites: [] } });
    const { queryClient } = renderMembros(SESSAO_OWNER);
    expect(await screen.findByTestId("membros-table")).toBeInTheDocument();

    mockApi({ "/api/membros": new Error("x"), "/api/convites": { convites: [] } });
    await queryClient.refetchQueries({ queryKey: chaveMembros() });

    await waitFor(() => expect(queryClient.getQueryState(chaveMembros())?.status).toBe("error"));
    expect(screen.getByTestId("membros-table")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
