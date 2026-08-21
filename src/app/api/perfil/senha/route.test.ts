/**
 * @jest-environment node
 */
import { PATCH } from "./route";
import { auth } from "@/lib/auth/config";
import { usuarioService, SenhaAtualIncorretaError } from "@/services/usuario.service";

jest.mock("@/lib/auth/config", () => ({ auth: jest.fn() }));
jest.mock("@/services/usuario.service", () => {
  const actual = jest.requireActual("@/services/usuario.service");
  return { ...actual, usuarioService: { alterarSenha: jest.fn() } };
});

const mockedAuth = auth as jest.Mock;
const mockedService = usuarioService as jest.Mocked<typeof usuarioService>;

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/perfil/senha", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/perfil/senha", () => {
  const payloadValido = { senhaAtual: "senha-atual-123", novaSenha: "senha-nova-123" };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("retorna 401 sem sessão", async () => {
    mockedAuth.mockResolvedValue(null);

    const response = await PATCH(buildRequest(payloadValido));

    expect(response.status).toBe(401);
    expect(mockedService.alterarSenha).not.toHaveBeenCalled();
  });

  it("retorna 400 para JSON inválido", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/perfil/senha", { method: "PATCH", body: "{x" })
    );

    expect(response.status).toBe(400);
  });

  it("retorna 400 para payload inválido (nova senha curta)", async () => {
    const response = await PATCH(buildRequest({ senhaAtual: "atual", novaSenha: "123" }));

    expect(response.status).toBe(400);
    expect(mockedService.alterarSenha).not.toHaveBeenCalled();
  });

  it("retorna 200 quando a senha é alterada", async () => {
    mockedService.alterarSenha.mockResolvedValue(undefined);

    const response = await PATCH(buildRequest(payloadValido));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockedService.alterarSenha).toHaveBeenCalledWith(
      "user-1",
      payloadValido.senhaAtual,
      payloadValido.novaSenha
    );
  });

  it("retorna 400 quando a senha atual está incorreta", async () => {
    mockedService.alterarSenha.mockRejectedValue(new SenhaAtualIncorretaError());

    const response = await PATCH(buildRequest(payloadValido));

    expect(response.status).toBe(400);
  });

  it("retorna 500 para erro inesperado", async () => {
    mockedService.alterarSenha.mockRejectedValue(new Error("boom"));

    const response = await PATCH(buildRequest(payloadValido));

    expect(response.status).toBe(500);
  });
});
