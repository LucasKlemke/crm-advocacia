/**
 * @jest-environment node
 */
import { POST } from "./route";
import { auth, unstable_update } from "@/lib/auth/config";
import { membroService, PermissaoNegadaError } from "@/services/membro.service";

jest.mock("@/lib/auth/config", () => ({
  auth: jest.fn(),
  unstable_update: jest.fn(),
}));
jest.mock("@/services/membro.service", () => {
  const actual = jest.requireActual("@/services/membro.service");
  return { ...actual, membroService: { trocarEscritorioAtivo: jest.fn() } };
});

const mockedAuth = auth as jest.Mock;
const mockedUpdate = unstable_update as jest.Mock;
const mockedService = membroService as jest.Mocked<typeof membroService>;

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/sessao/escritorio-ativo", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/sessao/escritorio-ativo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuth.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("retorna 401 sem sessão", async () => {
    mockedAuth.mockResolvedValue(null);

    const response = await POST(buildRequest({ escritorioId: "esc-1" }));

    expect(response.status).toBe(401);
    expect(mockedService.trocarEscritorioAtivo).not.toHaveBeenCalled();
  });

  it("retorna 400 para JSON inválido", async () => {
    const response = await POST(
      new Request("http://localhost/api/sessao/escritorio-ativo", { method: "POST", body: "{x" })
    );

    expect(response.status).toBe(400);
  });

  it("retorna 400 para payload inválido", async () => {
    const response = await POST(buildRequest({}));

    expect(response.status).toBe(400);
    expect(mockedService.trocarEscritorioAtivo).not.toHaveBeenCalled();
  });

  it("retorna 403 quando o usuário não é membro do escritório alvo", async () => {
    mockedService.trocarEscritorioAtivo.mockRejectedValue(new PermissaoNegadaError());

    const response = await POST(buildRequest({ escritorioId: "esc-999" }));

    expect(response.status).toBe(403);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("troca o escritório ativo e atualiza a sessão via unstable_update", async () => {
    mockedService.trocarEscritorioAtivo.mockResolvedValue({
      escritorioId: "esc-2",
      role: "admin",
    } as never);

    const response = await POST(buildRequest({ escritorioId: "esc-2" }));
    const json = await response.json();

    expect(mockedService.trocarEscritorioAtivo).toHaveBeenCalledWith("user-1", "esc-2");
    expect(mockedUpdate).toHaveBeenCalledWith({ user: { escritorioId: "esc-2" } });
    expect(json).toEqual({ escritorioId: "esc-2", role: "admin" });
  });

  it("retorna 500 para erro inesperado", async () => {
    mockedService.trocarEscritorioAtivo.mockRejectedValue(new Error("boom"));

    const response = await POST(buildRequest({ escritorioId: "esc-2" }));

    expect(response.status).toBe(500);
  });
});
