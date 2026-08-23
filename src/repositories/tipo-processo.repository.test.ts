/**
 * @jest-environment node
 */
import { prisma } from "@/lib/prisma";
import { tipoProcessoRepository } from "./tipo-processo.repository";
import { statusRepository } from "./status.repository";
import { tipoStatusRepository } from "./tipo-status.repository";
import { escritorioRepository } from "./escritorio.repository";
import { clienteRepository } from "./cliente.repository";

describe("tipoProcessoRepository", () => {
  let escritorioId: string;
  let outroEscritorioId: string;

  beforeAll(async () => {
    const escritorio = await escritorioRepository.create({ nome: "Escritório Tipo Processo Repo" });
    escritorioId = escritorio.id;
    const outro = await escritorioRepository.create({ nome: "Outro Escritório Tipo Proc Repo" });
    outroEscritorioId = outro.id;
  });

  afterEach(async () => {
    await prisma.caso.deleteMany({
      where: { escritorioId: { in: [escritorioId, outroEscritorioId] } },
    });
    await prisma.cliente.deleteMany({
      where: { escritorioId: { in: [escritorioId, outroEscritorioId] } },
    });
    await prisma.status.deleteMany({
      where: { escritorioId: { in: [escritorioId, outroEscritorioId] } },
    });
    await prisma.tipoProcesso.deleteMany({
      where: { escritorioId: { in: [escritorioId, outroEscritorioId] } },
    });
  });

  afterAll(async () => {
    await prisma.escritorio.deleteMany({
      where: { id: { in: [escritorioId, outroEscritorioId] } },
    });
    await prisma.$disconnect();
  });

  function criar(escritorio: string, dados: { nome: string; ordem: number }) {
    return tipoProcessoRepository.create({
      nome: dados.nome,
      icone: "Briefcase",
      cor: "#6366f1",
      ordem: dados.ordem,
      escritorio: { connect: { id: escritorio } },
    });
  }

  it("cria um tipo vinculado ao escritório", async () => {
    const tipo = await criar(escritorioId, { nome: "Juros abusivos", ordem: 1 });
    expect(tipo.escritorioId).toBe(escritorioId);
    expect(tipo.nome).toBe("Juros abusivos");
  });

  it("listar traz só os tipos do escritório, ordenados por ordem (RN19)", async () => {
    await criar(escritorioId, { nome: "Segundo", ordem: 2 });
    await criar(escritorioId, { nome: "Primeiro", ordem: 1 });
    await criar(outroEscritorioId, { nome: "De Outro Tenant", ordem: 1 });

    const tipos = await tipoProcessoRepository.listar(escritorioId);
    expect(tipos.map((t) => t.nome)).toEqual(["Primeiro", "Segundo"]);
  });

  it("findByNome busca dentro do escritório e ignora o de outro tenant", async () => {
    await criar(escritorioId, { nome: "Divórcio", ordem: 1 });

    expect(await tipoProcessoRepository.findByNome(escritorioId, "Divórcio")).not.toBeNull();
    expect(await tipoProcessoRepository.findByNome(outroEscritorioId, "Divórcio")).toBeNull();
  });

  it("permite o mesmo nome em escritórios diferentes", async () => {
    await criar(escritorioId, { nome: "Inventário", ordem: 1 });
    await expect(criar(outroEscritorioId, { nome: "Inventário", ordem: 1 })).resolves.toBeDefined();
  });

  it("recusa nome duplicado dentro do mesmo escritório", async () => {
    await criar(escritorioId, { nome: "Inventário", ordem: 1 });
    await expect(criar(escritorioId, { nome: "Inventário", ordem: 2 })).rejects.toThrow();
  });

  it("update altera os campos do tipo", async () => {
    const tipo = await criar(escritorioId, { nome: "Original", ordem: 1 });
    const atualizado = await tipoProcessoRepository.update(tipo.id, { nome: "Renomeado" });
    expect(atualizado.nome).toBe("Renomeado");
  });

  it("contarCasos conta os processos vinculados ao tipo", async () => {
    const tipo = await criar(escritorioId, { nome: "Com Casos", ordem: 1 });
    const tipoStatus = await tipoStatusRepository.findByChave("lead");
    const status = await statusRepository.create({
      nome: "Status Tipo Proc Repo",
      icone: "MessageCircle",
      cor: "#64748b",
      ordem: 1,
      escritorio: { connect: { id: escritorioId } },
      tipo: { connect: { id: tipoStatus!.id } },
    });
    const cliente = await clienteRepository.create({
      nome: "Cliente Tipo Proc",
      cpf: `${Date.now()}`.slice(-11),
      escritorio: { connect: { id: escritorioId } },
    });

    expect(await tipoProcessoRepository.contarCasos(tipo.id)).toBe(0);

    await prisma.caso.create({
      data: {
        escritorio: { connect: { id: escritorioId } },
        cliente: { connect: { id: cliente.id } },
        status: { connect: { id: status.id } },
        tipoProcesso: { connect: { id: tipo.id } },
      },
    });

    expect(await tipoProcessoRepository.contarCasos(tipo.id)).toBe(1);
  });

  it("delete remove o tipo quando não há processos vinculados", async () => {
    const tipo = await criar(escritorioId, { nome: "Para Excluir", ordem: 1 });
    await tipoProcessoRepository.delete(tipo.id);
    expect(await tipoProcessoRepository.findById(tipo.id)).toBeNull();
  });
});
