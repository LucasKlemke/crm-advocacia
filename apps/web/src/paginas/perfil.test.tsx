import { screen, waitFor } from "@testing-library/react";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { chavePerfil } from "@/hooks/use-perfil";
import { mockApi, renderPagina } from "@/lib/test-paginas";
import { PaginaPerfil } from "./perfil";

jest.mock("@/hooks/use-titulo-pagina", () => ({ useTituloPagina: jest.fn() }));
jest.mock("@/components/perfil/perfil-form", () => ({
  PerfilForm: ({ usuario }: { usuario: { nome: string; email: string } }) => (
    <div>
      <span>{usuario.nome}</span>
      <span>{usuario.email}</span>
    </div>
  ),
}));
jest.mock("@/components/perfil/senha-form", () => ({ SenhaForm: () => <div /> }));
jest.mock("@/components/perfil/avatar-upload", () => ({
  AvatarUpload: ({ temAvatarInicial }: { temAvatarInicial: boolean }) => (
    <div data-testid="avatar-upload" data-tem-avatar={String(temAvatarInicial)} />
  ),
}));

function renderPerfil() {
  return renderPagina(<PaginaPerfil />, { rota: "/perfil", caminho: "/perfil" });
}

describe("PaginaPerfil", () => {
  it("mostra os dados vindos de GET /api/perfil, não os da sessão", async () => {
    mockApi({ "/api/perfil": { usuario: { id: "u1", nome: "Nome Novo", email: "novo@teste.com", temAvatar: true } } });
    renderPerfil();

    expect(useTituloPagina).toHaveBeenCalledWith("Perfil");
    expect(await screen.findByText("Nome Novo")).toBeInTheDocument();
    expect(screen.getByText("novo@teste.com")).toBeInTheDocument();
    expect(screen.getByTestId("avatar-upload")).toHaveAttribute("data-tem-avatar", "true");
  });

  it("informa que o usuário não tem avatar", async () => {
    mockApi({ "/api/perfil": { usuario: { id: "u1", nome: "N", email: "n@t.com", temAvatar: false } } });
    renderPerfil();
    expect(await screen.findByTestId("avatar-upload")).toHaveAttribute("data-tem-avatar", "false");
  });

  it("mostra estado de carregamento antes dos dados", () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
    renderPerfil();
    expect(screen.getByRole("status", { name: /carregando perfil/i })).toBeInTheDocument();
  });

  it("mostra erro sem detalhe técnico quando a API falha", async () => {
    mockApi({ "/api/perfil": new Error("boom interno") });
    renderPerfil();
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar seu perfil.");
  });

  it("mantém os formulários montados quando um refetch em segundo plano falha", async () => {
    mockApi({ "/api/perfil": { usuario: { id: "u1", nome: "Nome Atual", email: "a@t.com", temAvatar: false } } });
    const { queryClient } = renderPerfil();
    expect(await screen.findByText("Nome Atual")).toBeInTheDocument();

    mockApi({ "/api/perfil": new Error("falha no refetch") });
    await queryClient.invalidateQueries({ queryKey: chavePerfil() });

    await waitFor(() => expect(queryClient.getQueryState(chavePerfil())?.status).toBe("error"));
    expect(screen.getByText("Nome Atual")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
