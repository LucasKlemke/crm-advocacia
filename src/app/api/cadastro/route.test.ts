/**
 * @jest-environment node
 */
import { POST } from "./route";
import { usuarioService, EmailJaCadastradoError } from "@/services/usuario.service";
import type { Usuario } from "@prisma/client";

jest.mock("@/services/usuario.service", () => {
  const actual = jest.requireActual("@/services/usuario.service");
  return {
    ...actual,
    usuarioService: { cadastrarUsuario: jest.fn() },
  };
});

const mockedService = usuarioService as jest.Mocked<typeof usuarioService>;

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/cadastro", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/cadastro", () => {
  const payloadValido = { nome: "Fulano de Tal", email: "fulano@teste.com", senha: "senha-forte-123" };

  afterEach(() => jest.clearAllMocks());

  it("retorna 201 e cria o usuário com payload válido", async () => {
    mockedService.cadastrarUsuario.mockResolvedValue({
      usuario: { id: "user-1", nome: payloadValido.nome, email: payloadValido.email } as Usuario,
      temEscritorio: false,
    });

    const response = await POST(buildRequest(payloadValido));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.usuario.email).toBe(payloadValido.email);
    expect(json.temEscritorio).toBe(false);
  });

  it("retorna temEscritorio true quando havia convite pendente", async () => {
    mockedService.cadastrarUsuario.mockResolvedValue({
      usuario: { id: "user-1", nome: payloadValido.nome, email: payloadValido.email } as Usuario,
      temEscritorio: true,
    });

    const response = await POST(buildRequest(payloadValido));
    const json = await response.json();

    expect(json.temEscritorio).toBe(true);
  });

  it("retorna 400 para JSON inválido", async () => {
    const response = await POST(
      new Request("http://localhost/api/cadastro", { method: "POST", body: "{invalido" })
    );

    expect(response.status).toBe(400);
    expect(mockedService.cadastrarUsuario).not.toHaveBeenCalled();
  });

  it("retorna 400 para payload inválido", async () => {
    const response = await POST(buildRequest({ nome: "", email: "invalido", senha: "123" }));

    expect(response.status).toBe(400);
    expect(mockedService.cadastrarUsuario).not.toHaveBeenCalled();
  });

  it("retorna 409 quando e-mail já está cadastrado", async () => {
    mockedService.cadastrarUsuario.mockRejectedValue(new EmailJaCadastradoError());

    const response = await POST(buildRequest(payloadValido));

    expect(response.status).toBe(409);
  });

  it("retorna 500 para erro inesperado", async () => {
    mockedService.cadastrarUsuario.mockRejectedValue(new Error("boom"));

    const response = await POST(buildRequest(payloadValido));

    expect(response.status).toBe(500);
  });
});
