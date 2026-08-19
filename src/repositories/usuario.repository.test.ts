/**
 * @jest-environment node
 */
import { prisma } from "@/lib/prisma";
import { usuarioRepository } from "./usuario.repository";

describe("usuarioRepository", () => {
  const usuariosCriados: string[] = [];

  afterEach(async () => {
    if (usuariosCriados.length) {
      await prisma.usuario.deleteMany({ where: { id: { in: usuariosCriados } } });
      usuariosCriados.length = 0;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("cria um usuário (perfil global, sem escritório)", async () => {
    const usuario = await usuarioRepository.create({
      nome: "Usuário Teste",
      email: `usuario-${Date.now()}@teste.com`,
      senhaHash: "hash",
    });
    usuariosCriados.push(usuario.id);

    expect(usuario.ativo).toBe(true);
    expect(usuario.id).toBeDefined();
  });

  it("normaliza o e-mail para minúsculo/trim ao criar", async () => {
    const email = `  Maiuscula-${Date.now()}@Teste.COM  `;
    const usuario = await usuarioRepository.create({
      nome: "Usuário Maiúsculo",
      email,
      senhaHash: "hash",
    });
    usuariosCriados.push(usuario.id);

    expect(usuario.email).toBe(email.trim().toLowerCase());
  });

  it("busca usuário por e-mail", async () => {
    const email = `busca-${Date.now()}@teste.com`;
    const criado = await usuarioRepository.create({
      nome: "Busca Teste",
      email,
      senhaHash: "hash",
    });
    usuariosCriados.push(criado.id);

    const encontrado = await usuarioRepository.findByEmail(email);

    expect(encontrado?.id).toBe(criado.id);
  });

  it("retorna null quando e-mail não existe", async () => {
    const encontrado = await usuarioRepository.findByEmail("nao-existe@teste.com");

    expect(encontrado).toBeNull();
  });

  it("busca usuário por id", async () => {
    const criado = await usuarioRepository.create({
      nome: "Por Id",
      email: `porid-${Date.now()}@teste.com`,
      senhaHash: "hash",
    });
    usuariosCriados.push(criado.id);

    const encontrado = await usuarioRepository.findById(criado.id);

    expect(encontrado?.id).toBe(criado.id);
  });

  it("retorna null ao buscar id inexistente", async () => {
    const encontrado = await usuarioRepository.findById("00000000-0000-0000-0000-000000000000");
    expect(encontrado).toBeNull();
  });

  it("atualiza dados do usuário", async () => {
    const criado = await usuarioRepository.create({
      nome: "Nome Antigo",
      email: `update-${Date.now()}@teste.com`,
      senhaHash: "hash",
    });
    usuariosCriados.push(criado.id);

    const atualizado = await usuarioRepository.update(criado.id, { nome: "Nome Novo" });

    expect(atualizado.nome).toBe("Nome Novo");
  });

  it("normaliza o e-mail para minúsculo/trim ao atualizar", async () => {
    const criado = await usuarioRepository.create({
      nome: "Email Update",
      email: `email-update-${Date.now()}@teste.com`,
      senhaHash: "hash",
    });
    usuariosCriados.push(criado.id);

    const novoEmail = `  Novo-Maiuscula-${Date.now()}@Teste.COM  `;
    const atualizado = await usuarioRepository.update(criado.id, { email: novoEmail });

    expect(atualizado.email).toBe(novoEmail.trim().toLowerCase());
  });

  it("atualiza o hash de senha do usuário", async () => {
    const criado = await usuarioRepository.create({
      nome: "Senha Teste",
      email: `senha-${Date.now()}@teste.com`,
      senhaHash: "hash-antigo",
    });
    usuariosCriados.push(criado.id);

    const atualizado = await usuarioRepository.updateSenhaHash(criado.id, "hash-novo");

    expect(atualizado.senhaHash).toBe("hash-novo");
  });
});
