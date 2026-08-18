/**
 * @jest-environment node
 */
import { prisma } from "@/lib/prisma";
import { usuarioRepository } from "./usuario.repository";
import { escritorioRepository } from "./escritorio.repository";

describe("usuarioRepository", () => {
  let escritorioId: string;
  const usuariosCriados: string[] = [];

  beforeAll(async () => {
    const escritorio = await escritorioRepository.create({ nome: "Escritório Usuario Repo" });
    escritorioId = escritorio.id;
  });

  afterEach(async () => {
    if (usuariosCriados.length) {
      await prisma.usuario.deleteMany({ where: { id: { in: usuariosCriados } } });
      usuariosCriados.length = 0;
    }
  });

  afterAll(async () => {
    await prisma.escritorio.delete({ where: { id: escritorioId } });
    await prisma.$disconnect();
  });

  it("cria um usuário titular vinculado ao escritório", async () => {
    const usuario = await usuarioRepository.create({
      nome: "Titular Teste",
      email: `titular-${Date.now()}@teste.com`,
      senhaHash: "hash",
      role: "titular",
      escritorio: { connect: { id: escritorioId } },
    });
    usuariosCriados.push(usuario.id);

    expect(usuario.escritorioId).toBe(escritorioId);
    expect(usuario.role).toBe("titular");
    expect(usuario.ativo).toBe(true);
  });

  it("busca usuário por e-mail", async () => {
    const email = `busca-${Date.now()}@teste.com`;
    const criado = await usuarioRepository.create({
      nome: "Busca Teste",
      email,
      senhaHash: "hash",
      role: "titular",
      escritorio: { connect: { id: escritorioId } },
    });
    usuariosCriados.push(criado.id);

    const encontrado = await usuarioRepository.findByEmail(email);

    expect(encontrado?.id).toBe(criado.id);
  });

  it("retorna null quando e-mail não existe", async () => {
    const encontrado = await usuarioRepository.findByEmail("nao-existe@teste.com");

    expect(encontrado).toBeNull();
  });
});
