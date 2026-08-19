/**
 * @jest-environment node
 */
import { POST } from "./route";
import { escritorioService } from "@/services/escritorio.service";
import { unstable_update } from "@/lib/auth/config";
import { getToken } from "next-auth/jwt";
import type { Escritorio, Membro } from "@prisma/client";

jest.mock("@/services/escritorio.service", () => ({
  escritorioService: { criarEscritorio: jest.fn() },
}));
jest.mock("@/lib/auth/config", () => ({
  unstable_update: jest.fn(),
}));
jest.mock("next-auth/jwt", () => ({
  getToken: jest.fn(),
}));

const mockedService = escritorioService as jest.Mocked<typeof escritorioService>;
const mockedGetToken = getToken as jest.Mock;
const mockedUpdate = unstable_update as jest.Mock;

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/escritorios", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/escritorios", () => {
  const payloadValido = { nome: "Escritório Teste" };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetToken.mockResolvedValue({ sub: "user-1" });
  });

  it("retorna 401 sem sessão", async () => {
    mockedGetToken.mockResolvedValue(null);

    const response = await POST(buildRequest(payloadValido));

    expect(response.status).toBe(401);
    expect(mockedService.criarEscritorio).not.toHaveBeenCalled();
  });

  it("retorna 201, cria o escritório com o usuário como owner e ativa na sessão", async () => {
    mockedService.criarEscritorio.mockResolvedValue({
      escritorio: { id: "esc-1", nome: payloadValido.nome } as Escritorio,
      membro: { id: "membro-1", role: "owner" } as Membro,
    });

    const response = await POST(buildRequest(payloadValido));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.role).toBe("owner");
    expect(mockedService.criarEscritorio).toHaveBeenCalledWith("user-1", payloadValido);
    expect(mockedUpdate).toHaveBeenCalledWith({ user: { escritorioId: "esc-1" } });
  });

  it("retorna 400 para JSON inválido", async () => {
    const response = await POST(
      new Request("http://localhost/api/escritorios", { method: "POST", body: "{invalido" })
    );

    expect(response.status).toBe(400);
  });

  it("retorna 400 para payload inválido", async () => {
    const response = await POST(buildRequest({ nome: "" }));

    expect(response.status).toBe(400);
    expect(mockedService.criarEscritorio).not.toHaveBeenCalled();
  });

  it("retorna 500 para erro inesperado", async () => {
    mockedService.criarEscritorio.mockRejectedValue(new Error("boom"));

    const response = await POST(buildRequest(payloadValido));

    expect(response.status).toBe(500);
  });
});
