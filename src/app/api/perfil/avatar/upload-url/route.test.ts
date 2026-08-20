/**
 * @jest-environment node
 */
import { POST } from "./route";
import { auth } from "@/lib/auth/config";
import { usuarioService, TamanhoAvatarInvalidoError } from "@/services/usuario.service";

jest.mock("@/lib/auth/config", () => ({ auth: jest.fn() }));
jest.mock("@/services/usuario.service", () => {
  const actual = jest.requireActual("@/services/usuario.service");
  return { ...actual, usuarioService: { gerarUrlUploadAvatar: jest.fn() } };
});

const mockedAuth = auth as jest.Mock;
const mockedService = usuarioService as jest.Mocked<typeof usuarioService>;

function request(body: unknown) {
  return new Request("http://localhost/api/perfil/avatar/upload-url", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedAuth.mockResolvedValue({ user: { id: "user-1" } });
});

describe("POST /api/perfil/avatar/upload-url", () => {
  it("devolve uploadUrl e storageKey", async () => {
    mockedService.gerarUrlUploadAvatar.mockResolvedValue({
      uploadUrl: "https://bucket.s3.amazonaws.com/signed-put-avatar",
      storageKey: "development/avatares/user-1/123-foto.png",
    });

    const resposta = await POST(request({ nomeArquivo: "foto.png", tipoArquivo: "png", tamanhoKb: 200 }));

    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo).toEqual({
      uploadUrl: "https://bucket.s3.amazonaws.com/signed-put-avatar",
      storageKey: "development/avatares/user-1/123-foto.png",
    });
  });

  it("recusa quando não há sessão", async () => {
    mockedAuth.mockResolvedValue(null);
    const resposta = await POST(request({ nomeArquivo: "foto.png", tipoArquivo: "png", tamanhoKb: 200 }));
    expect(resposta.status).toBe(401);
  });

  it("recusa payload inválido com 400", async () => {
    const resposta = await POST(request({ nomeArquivo: "foto.png" }));
    expect(resposta.status).toBe(400);
  });

  it.each([["../../../etc/passwd"], ["a/b.png"], ["..\\windows\\system32"], [".oculto.png"]])(
    "recusa nome de arquivo com travessia de caminho (%s) com 400",
    async (nomeArquivo) => {
      const resposta = await POST(request({ nomeArquivo, tipoArquivo: "png", tamanhoKb: 200 }));

      expect(resposta.status).toBe(400);
      expect(mockedService.gerarUrlUploadAvatar).not.toHaveBeenCalled();
    }
  );

  it("mapeia TamanhoAvatarInvalidoError para 400", async () => {
    mockedService.gerarUrlUploadAvatar.mockRejectedValue(new TamanhoAvatarInvalidoError());
    const resposta = await POST(request({ nomeArquivo: "grande.png", tipoArquivo: "png", tamanhoKb: 9999 }));
    expect(resposta.status).toBe(400);
  });
});
