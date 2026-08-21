/**
 * @jest-environment node
 */
import { prisma } from "@/lib/prisma";
import { tipoStatusRepository } from "./tipo-status.repository";

describe("tipoStatusRepository", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  // Seedados via migration SQL (6 linhas fixas) — a tabela é global e só de leitura.
  it("lista os tipos de status seedados, ordenados por ordem", async () => {
    const tipos = await tipoStatusRepository.listar();
    expect(tipos.length).toBeGreaterThanOrEqual(6);
    const ordens = tipos.map((t) => t.ordem);
    expect(ordens).toEqual([...ordens].sort((a, b) => a - b));
  });

  it("findByChave localiza um tipo pela chave", async () => {
    const tipo = await tipoStatusRepository.findByChave("nova_conversa");
    expect(tipo?.chave).toBe("nova_conversa");
  });

  it("findByChave devolve null para chave inexistente", async () => {
    expect(await tipoStatusRepository.findByChave("chave-que-nao-existe")).toBeNull();
  });
});
