/**
 * @jest-environment node
 */
import { POST } from "./route";
import { auth } from "@/lib/auth/config";
import { usuarioService } from "@/services/usuario.service";

jest.mock("@/lib/auth/config", () => ({ auth: jest.fn() }));
jest.mock("@/services/usuario.service", () => {
  const actual = jest.requireActual("@/services/usuario.service");
  return { ...actual, usuarioService: { confirmarUploadAvatar: jest.fn() } };
});

const mockedAuth = auth as jest.Mock;
const mockedService = usuarioService as jest.Mocked<typeof usuarioService>;

function request(body: unknown) {
  return new Request("http://localhost/api/perfil/avatar/confirmar", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedAuth.mockResolvedValue({ user: { id: "user-1" } });
});

describe("POST /api/perfil/avatar/confirmar", () => {
  it("confirma o avatar e devolve os dados públicos do usuário", async () => {
    mockedService.confirmarUploadAvatar.mockResolvedValue({
      id: "user-1",
      nome: "Fulano",
      email: "fulano@teste.com",
      avatarUrl: "development/avatares/user-1/123-foto.png",
    } as never);

    const resposta = await POST(request({ storageKey: "development/avatares/user-1/123-foto.png" }));

    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo).toEqual({
      usuario: {
        id: "user-1",
        nome: "Fulano",
        email: "fulano@teste.com",
        avatarUrl: "development/avatares/user-1/123-foto.png",
      },
    });
    expect(mockedService.confirmarUploadAvatar).toHaveBeenCalledWith(
      "user-1",
      "development/avatares/user-1/123-foto.png"
    );
  });

  it("recusa quando não há sessão", async () => {
    mockedAuth.mockResolvedValue(null);
    const resposta = await POST(request({ storageKey: "x" }));
    expect(resposta.status).toBe(401);
  });

  it("recusa payload inválido com 400", async () => {
    const resposta = await POST(request({}));
    expect(resposta.status).toBe(400);
  });
});
