/**
 * @jest-environment node
 */
import { POST } from "./route";
import { escritorioService, EmailJaCadastradoError } from "@/services/escritorio.service";
import type { Escritorio, Usuario } from "@prisma/client";

jest.mock("@/services/escritorio.service", () => {
  const actual = jest.requireActual("@/services/escritorio.service");
  return {
    ...actual,
    escritorioService: { cadastrarEscritorio: jest.fn() },
  };
});

const mockedService = escritorioService as jest.Mocked<typeof escritorioService>;

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/escritorios", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/escritorios", () => {
  const payloadValido = {
    nomeEscritorio: "Escritório Teste",
    nomeTitular: "Fulano de Tal",
    email: "fulano@teste.com",
    senha: "senha-forte-123",
  };

  afterEach(() => jest.clearAllMocks());

  it("retorna 201 e cria escritório + titular com payload válido", async () => {
    mockedService.cadastrarEscritorio.mockResolvedValue({
      escritorio: { id: "esc-1", nome: payloadValido.nomeEscritorio } as Escritorio,
      titular: { id: "user-1", email: payloadValido.email, role: "titular" } as Usuario,
    });

    const response = await POST(buildRequest(payloadValido));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.usuario.role).toBe("titular");
    expect(mockedService.cadastrarEscritorio).toHaveBeenCalledWith(
      expect.objectContaining({ email: payloadValido.email })
    );
  });

  it("retorna 400 para payload inválido", async () => {
    const response = await POST(buildRequest({ nomeEscritorio: "" }));

    expect(response.status).toBe(400);
    expect(mockedService.cadastrarEscritorio).not.toHaveBeenCalled();
  });

  it("retorna 409 quando e-mail já está cadastrado (FA-06)", async () => {
    mockedService.cadastrarEscritorio.mockRejectedValue(new EmailJaCadastradoError());

    const response = await POST(buildRequest(payloadValido));

    expect(response.status).toBe(409);
  });

  it("retorna 500 para erro inesperado", async () => {
    mockedService.cadastrarEscritorio.mockRejectedValue(new Error("boom"));

    const response = await POST(buildRequest(payloadValido));

    expect(response.status).toBe(500);
  });
});
