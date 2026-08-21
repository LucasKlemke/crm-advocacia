/**
 * @jest-environment node
 */
import { PATCH } from "./route";
import { auth } from "@/lib/auth/config";
import { usuarioService, EmailJaCadastradoError } from "@/services/usuario.service";

jest.mock("@/lib/auth/config", () => ({ auth: jest.fn() }));
jest.mock("@/services/usuario.service", () => {
  const actual = jest.requireActual("@/services/usuario.service");
  return { ...actual, usuarioService: { atualizarPerfil: jest.fn() } };
});

const mockedAuth = auth as jest.Mock;
const mockedService = usuarioService as jest.Mocked<typeof usuarioService>;

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/perfil", { method: "PATCH", body: JSON.stringify(body) });
}

describe("PATCH /api/perfil", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("retorna 401 sem sessão", async () => {
    mockedAuth.mockResolvedValue(null);

    const response = await PATCH(buildRequest({ nome: "Novo Nome" }));

    expect(response.status).toBe(401);
    expect(mockedService.atualizarPerfil).not.toHaveBeenCalled();
  });

  it("retorna 400 para JSON inválido", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/perfil", { method: "PATCH", body: "{x" })
    );

    expect(response.status).toBe(400);
  });

  it("retorna 400 para payload inválido", async () => {
    const response = await PATCH(buildRequest({ email: "invalido" }));

    expect(response.status).toBe(400);
    expect(mockedService.atualizarPerfil).not.toHaveBeenCalled();
  });

  it("retorna 200 com o perfil atualizado", async () => {
    mockedService.atualizarPerfil.mockResolvedValue({
      id: "user-1",
      nome: "Novo Nome",
      email: "novo@teste.com",
    } as never);

    const response = await PATCH(buildRequest({ nome: "Novo Nome", email: "novo@teste.com" }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.usuario.nome).toBe("Novo Nome");
    expect(mockedService.atualizarPerfil).toHaveBeenCalledWith("user-1", {
      nome: "Novo Nome",
      email: "novo@teste.com",
    });
  });

  it("retorna 409 quando o e-mail já pertence a outro usuário", async () => {
    mockedService.atualizarPerfil.mockRejectedValue(new EmailJaCadastradoError());

    const response = await PATCH(buildRequest({ email: "ocupado@teste.com" }));

    expect(response.status).toBe(409);
  });

  it("retorna 500 para erro inesperado", async () => {
    mockedService.atualizarPerfil.mockRejectedValue(new Error("boom"));

    const response = await PATCH(buildRequest({ nome: "Novo Nome" }));

    expect(response.status).toBe(500);
  });
});
