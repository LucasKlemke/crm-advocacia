/**
 * @jest-environment node
 */
import { GET } from "./route";
import { auth } from "@/lib/auth/config";
import { usuarioService } from "@/services/usuario.service";

jest.mock("@/lib/auth/config", () => ({ auth: jest.fn() }));
jest.mock("@/services/usuario.service", () => ({
  usuarioService: { gerarUrlDownloadAvatar: jest.fn() },
}));

const mockedAuth = auth as jest.Mock;
const mockedService = usuarioService as jest.Mocked<typeof usuarioService>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedAuth.mockResolvedValue({ user: { id: "user-1" } });
});

describe("GET /api/perfil/avatar/download-url", () => {
  it("devolve a URL assinada de download quando o usuário tem avatar", async () => {
    mockedService.gerarUrlDownloadAvatar.mockResolvedValue("https://bucket.s3.amazonaws.com/signed-get-avatar");

    const resposta = await GET();

    expect(mockedService.gerarUrlDownloadAvatar).toHaveBeenCalledWith("user-1");
    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo).toEqual({ downloadUrl: "https://bucket.s3.amazonaws.com/signed-get-avatar" });
  });

  it("devolve downloadUrl null quando o usuário não tem avatar", async () => {
    mockedService.gerarUrlDownloadAvatar.mockResolvedValue(null);

    const resposta = await GET();

    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo).toEqual({ downloadUrl: null });
  });

  it("recusa quando não há sessão", async () => {
    mockedAuth.mockResolvedValue(null);

    const resposta = await GET();

    expect(resposta.status).toBe(401);
    expect(mockedService.gerarUrlDownloadAvatar).not.toHaveBeenCalled();
  });
});
