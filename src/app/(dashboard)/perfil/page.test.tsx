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
    });

    render(await PerfilPage());

    expect(mockedObterPerfil).toHaveBeenCalledWith("u1");
    expect(screen.getByText("Nome Novo")).toBeInTheDocument();
    expect(screen.getByText("novo@teste.com")).toBeInTheDocument();
    expect(screen.queryByText("Nome Antigo")).not.toBeInTheDocument();
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
