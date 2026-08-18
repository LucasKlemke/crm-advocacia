import { escritorioService, EmailJaCadastradoError } from "./escritorio.service";
import { usuarioRepository } from "@/repositories/usuario.repository";
import { escritorioRepository } from "@/repositories/escritorio.repository";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

jest.mock("@/repositories/usuario.repository");
jest.mock("@/repositories/escritorio.repository");
jest.mock("@/lib/prisma", () => ({
  prisma: { $transaction: jest.fn() },
}));
jest.mock("bcrypt");

const mockedUsuarioRepo = usuarioRepository as jest.Mocked<typeof usuarioRepository>;
const mockedEscritorioRepo = escritorioRepository as jest.Mocked<typeof escritorioRepository>;
const mockedPrisma = prisma as unknown as { $transaction: jest.Mock };
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe("escritorioService.cadastrarEscritorio", () => {
  const input = {
    nomeEscritorio: "Escritório Teste",
    nomeTitular: "Fulano de Tal",
    email: "fulano@teste.com",
    senha: "senha-forte-123",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({})
    );
    mockedBcrypt.hash.mockResolvedValue("hash-fake" as never);
  });

  it("cria escritório e usuário titular numa única operação (RN02)", async () => {
    mockedUsuarioRepo.findByEmail.mockResolvedValue(null);
    mockedEscritorioRepo.create.mockResolvedValue({
      id: "esc-1",
      nome: input.nomeEscritorio,
    } as never);
    mockedUsuarioRepo.create.mockResolvedValue({
      id: "user-1",
      email: input.email,
      role: "titular",
    } as never);

    const result = await escritorioService.cadastrarEscritorio(input);

    expect(mockedEscritorioRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ nome: input.nomeEscritorio }),
      expect.anything()
    );
    expect(mockedUsuarioRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: input.email,
        senhaHash: "hash-fake",
        role: "titular",
      }),
      expect.anything()
    );
    expect(result.titular.role).toBe("titular");
  });

  it("faz hash da senha antes de persistir (RNF04)", async () => {
    mockedUsuarioRepo.findByEmail.mockResolvedValue(null);
    mockedEscritorioRepo.create.mockResolvedValue({ id: "esc-1" } as never);
    mockedUsuarioRepo.create.mockResolvedValue({ id: "user-1" } as never);

    await escritorioService.cadastrarEscritorio(input);

    expect(mockedBcrypt.hash).toHaveBeenCalledWith(input.senha, expect.any(Number));
  });

  it("rejeita cadastro quando e-mail já existe (RN02b/FA-06)", async () => {
    mockedUsuarioRepo.findByEmail.mockResolvedValue({ id: "existing" } as never);

    await expect(escritorioService.cadastrarEscritorio(input)).rejects.toThrow(
      EmailJaCadastradoError
    );
    expect(mockedEscritorioRepo.create).not.toHaveBeenCalled();
  });

  it("rejeita cadastro quando a constraint única do banco é violada em condição de corrida", async () => {
    mockedUsuarioRepo.findByEmail.mockResolvedValue(null);
    mockedEscritorioRepo.create.mockResolvedValue({ id: "esc-1" } as never);
    const prismaError = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
    });
    mockedUsuarioRepo.create.mockRejectedValue(prismaError);

    await expect(escritorioService.cadastrarEscritorio(input)).rejects.toThrow(
      EmailJaCadastradoError
    );
  });
});
