import { render, screen } from "@testing-library/react";
import { auth } from "@/lib/auth/config";
import { usuarioService } from "@/services/usuario.service";
import PerfilPage from "./page";

jest.mock("@/lib/auth/config", () => ({ auth: jest.fn() }));
jest.mock("@/services/usuario.service", () => ({
  usuarioService: { obterPerfil: jest.fn() },
}));
jest.mock("next/navigation", () => ({
  redirect: jest.fn((destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  }),
}));
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
    <div data-testid="avatar-upload" data-tem-avatar={temAvatarInicial} />
  ),
}));

const mockedAuth = auth as unknown as jest.Mock;
const mockedObterPerfil = usuarioService.obterPerfil as jest.Mock;

describe("PerfilPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Bug: nome/e-mail vinham do JWT, que o PATCH /api/perfil não renova — o dado salvo só
  // aparecia depois de um novo login.
  it("mostra os dados do banco, não os do JWT", async () => {
    mockedAuth.mockResolvedValue({
      user: { id: "u1", name: "Nome Antigo", email: "antigo@teste.com" },
    });
    mockedObterPerfil.mockResolvedValue({
      id: "u1",
      nome: "Nome Novo",
      email: "novo@teste.com",
      avatarUrl: "development/avatares/u1/1-foto.png",
    });

    render(await PerfilPage());

    expect(mockedObterPerfil).toHaveBeenCalledWith("u1");
    expect(screen.getByText("Nome Novo")).toBeInTheDocument();
    expect(screen.getByText("novo@teste.com")).toBeInTheDocument();
    expect(screen.queryByText("Nome Antigo")).not.toBeInTheDocument();
    expect(screen.getByTestId("avatar-upload")).toHaveAttribute("data-tem-avatar", "true");
  });

  it("informa que o usuário não tem avatar quando avatarUrl é null", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "u1" } });
    mockedObterPerfil.mockResolvedValue({
      id: "u1",
      nome: "Nome Novo",
      email: "novo@teste.com",
      avatarUrl: null,
    });

    render(await PerfilPage());

    expect(screen.getByTestId("avatar-upload")).toHaveAttribute("data-tem-avatar", "false");
  });

  it("manda para o login sem sessão", async () => {
    mockedAuth.mockResolvedValue(null);

    await expect(PerfilPage()).rejects.toThrow("REDIRECT:/login");
    expect(mockedObterPerfil).not.toHaveBeenCalled();
  });

  it("manda para o login quando o usuário não existe mais no banco", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "u1" } });
    mockedObterPerfil.mockResolvedValue(null);

    await expect(PerfilPage()).rejects.toThrow("REDIRECT:/login");
  });
});
