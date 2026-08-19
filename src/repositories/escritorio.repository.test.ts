/**
 * @jest-environment node
 */
import { prisma } from "@/lib/prisma";
import { escritorioRepository } from "./escritorio.repository";

describe("escritorioRepository", () => {
  const criados: string[] = [];

  afterEach(async () => {
    if (criados.length) {
      await prisma.escritorio.deleteMany({ where: { id: { in: criados } } });
      criados.length = 0;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("cria um escritório", async () => {
    const escritorio = await escritorioRepository.create({ nome: "Escritório Repo Teste" });
    criados.push(escritorio.id);

    expect(escritorio.id).toBeDefined();
    expect(escritorio.nome).toBe("Escritório Repo Teste");
    expect(escritorio.ativo).toBe(true);
  });

  it("busca um escritório por id", async () => {
    const criado = await escritorioRepository.create({ nome: "Outro Escritório" });
    criados.push(criado.id);

    const encontrado = await escritorioRepository.findById(criado.id);

    expect(encontrado?.id).toBe(criado.id);
  });

  it("retorna null para escritório inexistente", async () => {
    const encontrado = await escritorioRepository.findById(
      "00000000-0000-0000-0000-000000000000"
    );

    expect(encontrado).toBeNull();
  });

  it("atualiza dados do escritório", async () => {
    const criado = await escritorioRepository.create({ nome: "Nome Antigo" });
    criados.push(criado.id);

    const atualizado = await escritorioRepository.update(criado.id, { nome: "Nome Novo" });

    expect(atualizado.nome).toBe("Nome Novo");
  });
});
