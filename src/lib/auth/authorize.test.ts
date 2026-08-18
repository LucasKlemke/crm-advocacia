import { authorizeCredentials } from "./authorize";
import { usuarioRepository } from "@/repositories/usuario.repository";
import bcrypt from "bcrypt";

jest.mock("@/repositories/usuario.repository");
jest.mock("bcrypt");

const mockedUsuarioRepo = usuarioRepository as jest.Mocked<typeof usuarioRepository>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe("authorizeCredentials", () => {
  afterEach(() => jest.clearAllMocks());

  it("retorna null quando e-mail ou senha não são strings", async () => {
    expect(await authorizeCredentials(undefined, "senha")).toBeNull();
    expect(await authorizeCredentials("email@teste.com", undefined)).toBeNull();
    expect(mockedUsuarioRepo.findByEmail).not.toHaveBeenCalled();
  });

  it("retorna null quando o usuário não existe (FA-01)", async () => {
    mockedUsuarioRepo.findByEmail.mockResolvedValue(null);

    const resultado = await authorizeCredentials("email@teste.com", "senha-123");

    expect(resultado).toBeNull();
  });

  it("retorna null quando o usuário está inativo", async () => {
    mockedUsuarioRepo.findByEmail.mockResolvedValue({
      id: "user-1",
      ativo: false,
      senhaHash: "hash",
    } as never);

    const resultado = await authorizeCredentials("email@teste.com", "senha-123");

    expect(resultado).toBeNull();
    expect(mockedBcrypt.compare).not.toHaveBeenCalled();
  });

  it("retorna null quando a senha está incorreta (FA-01)", async () => {
    mockedUsuarioRepo.findByEmail.mockResolvedValue({
      id: "user-1",
      ativo: true,
      senhaHash: "hash",
    } as never);
    mockedBcrypt.compare.mockResolvedValue(false as never);

    const resultado = await authorizeCredentials("email@teste.com", "senha-errada");

    expect(resultado).toBeNull();
  });

  it("retorna os dados do usuário quando as credenciais são válidas", async () => {
    mockedUsuarioRepo.findByEmail.mockResolvedValue({
      id: "user-1",
      ativo: true,
      senhaHash: "hash",
      email: "email@teste.com",
      nome: "Fulano",
      escritorioId: "esc-1",
      role: "titular",
    } as never);
    mockedBcrypt.compare.mockResolvedValue(true as never);

    const resultado = await authorizeCredentials("email@teste.com", "senha-correta");

    expect(resultado).toEqual({
      id: "user-1",
      email: "email@teste.com",
      name: "Fulano",
      escritorioId: "esc-1",
      role: "titular",
    });
  });
});
