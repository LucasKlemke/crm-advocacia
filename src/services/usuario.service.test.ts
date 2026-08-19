import {
  usuarioService,
  EmailJaCadastradoError,
  SenhaAtualIncorretaError,
} from "./usuario.service";
import { usuarioRepository } from "@/repositories/usuario.repository";
import { conviteRepository } from "@/repositories/convite.repository";
import { membroRepository } from "@/repositories/membro.repository";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

jest.mock("@/repositories/usuario.repository");
jest.mock("@/repositories/convite.repository");
jest.mock("@/repositories/membro.repository");
jest.mock("@/lib/prisma", () => ({
  prisma: { $transaction: jest.fn() },
}));
jest.mock("bcrypt");

const mockedUsuarioRepo = usuarioRepository as jest.Mocked<typeof usuarioRepository>;
const mockedConviteRepo = conviteRepository as jest.Mocked<typeof conviteRepository>;
const mockedMembroRepo = membroRepository as jest.Mocked<typeof membroRepository>;
const mockedPrisma = prisma as unknown as { $transaction: jest.Mock };
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe("usuarioService.cadastrarUsuario", () => {
  const input = { nome: "Fulano de Tal", email: "fulano@teste.com", senha: "senha-forte-123" };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({})
    );
    mockedBcrypt.hash.mockResolvedValue("hash-fake" as never);
  });

  it("rejeita cadastro quando e-mail já existe", async () => {
    mockedUsuarioRepo.findByEmail.mockResolvedValue({ id: "existing" } as never);

    await expect(usuarioService.cadastrarUsuario(input)).rejects.toThrow(EmailJaCadastradoError);
  });

  it("faz hash da senha antes de persistir", async () => {
    mockedUsuarioRepo.findByEmail.mockResolvedValue(null);
    mockedUsuarioRepo.create.mockResolvedValue({ id: "user-1" } as never);
    mockedConviteRepo.listarPorEmail.mockResolvedValue([]);

    await usuarioService.cadastrarUsuario(input);

    expect(mockedBcrypt.hash).toHaveBeenCalledWith(input.senha, expect.any(Number));
    expect(mockedUsuarioRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ senhaHash: "hash-fake" }),
      expect.anything()
    );
  });

  it("cadastra sem convite pendente -> temEscritorio false, sem criar membership", async () => {
    mockedUsuarioRepo.findByEmail.mockResolvedValue(null);
    mockedUsuarioRepo.create.mockResolvedValue({ id: "user-1" } as never);
    mockedConviteRepo.listarPorEmail.mockResolvedValue([]);

    const resultado = await usuarioService.cadastrarUsuario(input);

    expect(resultado.temEscritorio).toBe(false);
    expect(mockedMembroRepo.create).not.toHaveBeenCalled();
    expect(mockedConviteRepo.removerTodosPorEmail).not.toHaveBeenCalled();
  });

  it("cadastra com convite(s) pendente(s) -> cria membership(s) e consome os convites (temEscritorio true)", async () => {
    mockedUsuarioRepo.findByEmail.mockResolvedValue(null);
    mockedUsuarioRepo.create.mockResolvedValue({ id: "user-1" } as never);
    const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000);
    mockedConviteRepo.listarPorEmail.mockResolvedValue([
      { id: "conv-1", escritorioId: "esc-1", role: "admin", expiraEm: amanha },
      { id: "conv-2", escritorioId: "esc-2", role: "padrao", expiraEm: amanha },
    ] as never);

    const resultado = await usuarioService.cadastrarUsuario(input);

    expect(mockedMembroRepo.create).toHaveBeenCalledTimes(2);
    expect(mockedMembroRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        usuario: { connect: { id: "user-1" } },
        escritorio: { connect: { id: "esc-1" } },
        role: "admin",
      }),
      expect.anything()
    );
    expect(mockedConviteRepo.removerTodosPorEmail).toHaveBeenCalledWith(
      input.email,
      expect.anything()
    );
    expect(resultado.temEscritorio).toBe(true);
  });

  it("ignora convites expirados ao cadastrar (nao cria membership, mas limpa a linha)", async () => {
    mockedUsuarioRepo.findByEmail.mockResolvedValue(null);
    mockedUsuarioRepo.create.mockResolvedValue({ id: "user-1" } as never);
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
    mockedConviteRepo.listarPorEmail.mockResolvedValue([
      { id: "conv-1", escritorioId: "esc-1", role: "admin", expiraEm: ontem },
    ] as never);

    const resultado = await usuarioService.cadastrarUsuario(input);

    expect(mockedMembroRepo.create).not.toHaveBeenCalled();
    expect(mockedConviteRepo.removerTodosPorEmail).toHaveBeenCalledWith(
      input.email,
      expect.anything()
    );
    expect(resultado.temEscritorio).toBe(false);
  });

  it("rejeita cadastro quando a constraint única do banco é violada em condição de corrida", async () => {
    mockedUsuarioRepo.findByEmail.mockResolvedValue(null);
    const prismaError = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    mockedUsuarioRepo.create.mockRejectedValue(prismaError);

    await expect(usuarioService.cadastrarUsuario(input)).rejects.toThrow(EmailJaCadastradoError);
  });

  it("propaga erros inesperados da transação", async () => {
    mockedUsuarioRepo.findByEmail.mockResolvedValue(null);
    mockedUsuarioRepo.create.mockRejectedValue(new Error("boom"));

    await expect(usuarioService.cadastrarUsuario(input)).rejects.toThrow("boom");
  });
});

describe("usuarioService.atualizarPerfil", () => {
  beforeEach(() => jest.clearAllMocks());

  it("atualiza nome e e-mail quando e-mail não conflita com outro usuário", async () => {
    mockedUsuarioRepo.findByEmail.mockResolvedValue(null);
    mockedUsuarioRepo.update.mockResolvedValue({ id: "user-1", nome: "Novo Nome" } as never);

    const resultado = await usuarioService.atualizarPerfil("user-1", {
      nome: "Novo Nome",
      email: "novo@teste.com",
    });

    expect(mockedUsuarioRepo.update).toHaveBeenCalledWith("user-1", {
      nome: "Novo Nome",
      email: "novo@teste.com",
    });
    expect(resultado.nome).toBe("Novo Nome");
  });

  it("permite manter o próprio e-mail (encontra a si mesmo)", async () => {
    mockedUsuarioRepo.findByEmail.mockResolvedValue({ id: "user-1" } as never);
    mockedUsuarioRepo.update.mockResolvedValue({ id: "user-1" } as never);

    await expect(
      usuarioService.atualizarPerfil("user-1", { email: "mesmo@teste.com" })
    ).resolves.toBeDefined();
  });

  it("rejeita quando o e-mail já pertence a outro usuário", async () => {
    mockedUsuarioRepo.findByEmail.mockResolvedValue({ id: "outro-user" } as never);

    await expect(
      usuarioService.atualizarPerfil("user-1", { email: "ocupado@teste.com" })
    ).rejects.toThrow(EmailJaCadastradoError);
    expect(mockedUsuarioRepo.update).not.toHaveBeenCalled();
  });

  it("atualiza somente o nome quando e-mail não é informado", async () => {
    mockedUsuarioRepo.update.mockResolvedValue({ id: "user-1" } as never);

    await usuarioService.atualizarPerfil("user-1", { nome: "Só Nome" });

    expect(mockedUsuarioRepo.findByEmail).not.toHaveBeenCalled();
    expect(mockedUsuarioRepo.update).toHaveBeenCalledWith("user-1", { nome: "Só Nome" });
  });

  it("rejeita com EmailJaCadastradoError quando a constraint única do banco é violada em condição de corrida", async () => {
    mockedUsuarioRepo.findByEmail.mockResolvedValue(null);
    const prismaError = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    mockedUsuarioRepo.update.mockRejectedValue(prismaError);

    await expect(
      usuarioService.atualizarPerfil("user-1", { email: "corrida@teste.com" })
    ).rejects.toThrow(EmailJaCadastradoError);
  });
});

describe("usuarioService.alterarSenha", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejeita quando usuário não existe", async () => {
    mockedUsuarioRepo.findById.mockResolvedValue(null);

    await expect(usuarioService.alterarSenha("user-1", "atual", "nova")).rejects.toThrow(
      SenhaAtualIncorretaError
    );
  });

  it("rejeita quando a senha atual está incorreta", async () => {
    mockedUsuarioRepo.findById.mockResolvedValue({ id: "user-1", senhaHash: "hash" } as never);
    mockedBcrypt.compare.mockResolvedValue(false as never);

    await expect(usuarioService.alterarSenha("user-1", "errada", "nova")).rejects.toThrow(
      SenhaAtualIncorretaError
    );
    expect(mockedUsuarioRepo.updateSenhaHash).not.toHaveBeenCalled();
  });

  it("atualiza o hash quando a senha atual está correta", async () => {
    mockedUsuarioRepo.findById.mockResolvedValue({ id: "user-1", senhaHash: "hash" } as never);
    mockedBcrypt.compare.mockResolvedValue(true as never);
    mockedBcrypt.hash.mockResolvedValue("novo-hash" as never);

    await usuarioService.alterarSenha("user-1", "atual", "nova-senha-123");

    expect(mockedUsuarioRepo.updateSenhaHash).toHaveBeenCalledWith("user-1", "novo-hash");
  });
});
