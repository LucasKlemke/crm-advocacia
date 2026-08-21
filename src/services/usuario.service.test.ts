/**
 * @jest-environment node
 */
import {
  usuarioService,
  EmailJaCadastradoError,
  SenhaAtualIncorretaError,
  TamanhoAvatarInvalidoError,
  StorageKeyInvalidoError,
} from "./usuario.service";
import { usuarioRepository } from "@/repositories/usuario.repository";
import { conviteRepository } from "@/repositories/convite.repository";
import { membroRepository } from "@/repositories/membro.repository";
import { prisma } from "@/lib/prisma";
import { s3Client } from "@/lib/external/s3-client";
import bcrypt from "bcrypt";

jest.mock("@/repositories/usuario.repository");
jest.mock("@/repositories/convite.repository");
jest.mock("@/repositories/membro.repository");
jest.mock("@/lib/prisma", () => ({
  prisma: { $transaction: jest.fn() },
}));
jest.mock("@/lib/external/s3-client");
jest.mock("bcrypt");

const mockedUsuarioRepo = usuarioRepository as jest.Mocked<typeof usuarioRepository>;
const mockedConviteRepo = conviteRepository as jest.Mocked<typeof conviteRepository>;
const mockedMembroRepo = membroRepository as jest.Mocked<typeof membroRepository>;
const mockedPrisma = prisma as unknown as { $transaction: jest.Mock };
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const s3 = s3Client as jest.Mocked<typeof s3Client>;
const repo = mockedUsuarioRepo;

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

describe("usuarioService.obterPerfil", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retorna o usuário do banco (não do JWT) para o id informado", async () => {
    const usuario = { id: "u1", nome: "Nome Novo", email: "novo@teste.com" };
    mockedUsuarioRepo.findById.mockResolvedValue(usuario as never);

    await expect(usuarioService.obterPerfil("u1")).resolves.toEqual(usuario);
    expect(mockedUsuarioRepo.findById).toHaveBeenCalledWith("u1");
  });

  it("retorna null quando o usuário não existe mais", async () => {
    mockedUsuarioRepo.findById.mockResolvedValue(null as never);

    await expect(usuarioService.obterPerfil("sumiu")).resolves.toBeNull();
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

describe("usuarioService.gerarUrlUploadAvatar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    s3.gerarUrlUpload.mockResolvedValue("https://bucket.s3.amazonaws.com/signed-put-avatar");
  });

  it("monta a key sob avatares/{usuarioId} e devolve a URL assinada de PUT", async () => {
    const resultado = await usuarioService.gerarUrlUploadAvatar("user-1", {
      nomeArquivo: "foto.png",
      tipoArquivo: "png",
      tamanhoBytes: 204_800,
    });

    // Key completa (só o timestamp é variável): uma regressão que perdesse o prefixo e
    // gerasse "undefined/avatares/..." precisa quebrar aqui.
    expect(resultado.storageKey).toMatch(/^development\/avatares\/user-1\/\d+-foto\.png$/);
    expect(resultado.uploadUrl).toBe("https://bucket.s3.amazonaws.com/signed-put-avatar");
    expect(s3.gerarUrlUpload).toHaveBeenCalledWith(resultado.storageKey, "image/png", 204_800);
  });

  // Bug: assinar com Math.ceil(bytes/1024)*1024 (arredondado pra cima) diverge do
  // Content-Length real que o navegador envia no PUT, e o S3 rejeita com
  // SignatureDoesNotMatch — content-length é um header assinado. Por isso o valor
  // assinado tem que ser o tamanho exato em bytes, nunca um KB arredondado.
  it("assina com o tamanho exato em bytes, não um KB arredondado", async () => {
    await usuarioService.gerarUrlUploadAvatar("user-1", {
      nomeArquivo: "foto.png",
      tipoArquivo: "png",
      tamanhoBytes: 1_687_900,
    });

    expect(s3.gerarUrlUpload).toHaveBeenCalledWith(expect.any(String), "image/png", 1_687_900);
  });

  it("falha explicitamente quando AWS_S3_PREFIX não está configurado", async () => {
    const original = process.env.AWS_S3_PREFIX;
    delete process.env.AWS_S3_PREFIX;
    try {
      await expect(
        usuarioService.gerarUrlUploadAvatar("user-1", {
          nomeArquivo: "foto.png",
          tipoArquivo: "png",
          tamanhoBytes: 204_800,
        })
      ).rejects.toThrow("AWS_S3_PREFIX não configurado.");
      expect(s3.gerarUrlUpload).not.toHaveBeenCalled();
    } finally {
      process.env.AWS_S3_PREFIX = original;
    }
  });

  // Avatar é mais restrito que documento: 5MB, não 10MB (spec: "mais restrito porque
  // avatar é sempre exibido pequeno").
  it("recusa avatar maior que 5MB antes de chamar o S3", async () => {
    await expect(
      usuarioService.gerarUrlUploadAvatar("user-1", {
        nomeArquivo: "grande.png",
        tipoArquivo: "png",
        tamanhoBytes: 5121 * 1024,
      })
    ).rejects.toThrow(TamanhoAvatarInvalidoError);
    expect(s3.gerarUrlUpload).not.toHaveBeenCalled();
  });
});

describe("usuarioService.confirmarUploadAvatar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sobrescreve avatarUrl e apaga a key antiga do S3", async () => {
    repo.findById.mockResolvedValue({
      id: "user-1",
      nome: "Fulano",
      email: "fulano@teste.com",
      senhaHash: "hash",
      avatarUrl: "development/avatares/user-1/111-antiga.png",
      oab: null,
      telefone: null,
      ativo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    repo.update.mockResolvedValue({ id: "user-1", avatarUrl: "development/avatares/user-1/222-nova.png" } as never);

    await usuarioService.confirmarUploadAvatar("user-1", "development/avatares/user-1/222-nova.png");

    expect(s3.excluirArquivo).toHaveBeenCalledWith("development/avatares/user-1/111-antiga.png");
    expect(repo.update).toHaveBeenCalledWith("user-1", {
      avatarUrl: "development/avatares/user-1/222-nova.png",
    });
  });

  it("não tenta apagar do S3 quando não havia avatar anterior", async () => {
    repo.findById.mockResolvedValue({ id: "user-1", avatarUrl: null } as never);
    repo.update.mockResolvedValue({ id: "user-1", avatarUrl: "development/avatares/user-1/222-nova.png" } as never);

    await usuarioService.confirmarUploadAvatar("user-1", "development/avatares/user-1/222-nova.png");

    expect(s3.excluirArquivo).not.toHaveBeenCalled();
  });

  // A key não é re-derivável (carrega timestamp), então a garantia é de escopo: só key
  // sob avatares/{proprio-usuario}/ é aceita.
  it("recusa storageKey do diretório de avatar de outro usuário", async () => {
    await expect(
      usuarioService.confirmarUploadAvatar("user-1", "development/avatares/user-2/222-nova.png")
    ).rejects.toThrow(StorageKeyInvalidoError);
    expect(repo.findById).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
    expect(s3.excluirArquivo).not.toHaveBeenCalled();
  });

  it("recusa storageKey apontando para fora do diretório de avatares", async () => {
    await expect(
      usuarioService.confirmarUploadAvatar(
        "user-1",
        "development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf"
      )
    ).rejects.toThrow(StorageKeyInvalidoError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("falha explicitamente quando AWS_S3_PREFIX não está configurado", async () => {
    const original = process.env.AWS_S3_PREFIX;
    delete process.env.AWS_S3_PREFIX;
    try {
      await expect(
        usuarioService.confirmarUploadAvatar("user-1", "development/avatares/user-1/222-nova.png")
      ).rejects.toThrow("AWS_S3_PREFIX não configurado.");
      expect(repo.update).not.toHaveBeenCalled();
    } finally {
      process.env.AWS_S3_PREFIX = original;
    }
  });
});
