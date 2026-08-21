/**
 * @jest-environment node
 */
import { prisma } from "@/lib/prisma";
import { statusRepository } from "./status.repository";
import { tipoStatusRepository } from "./tipo-status.repository";
import { escritorioRepository } from "./escritorio.repository";
import { clienteRepository } from "./cliente.repository";

describe("statusRepository", () => {
  let escritorioId: string;
  let outroEscritorioId: string;
  let tipoStatusId: string;

  beforeAll(async () => {
    const escritorio = await escritorioRepository.create({ nome: "Escritório Status Repo" });
    escritorioId = escritorio.id;
    const outro = await escritorioRepository.create({ nome: "Outro Escritório Status Repo" });
    outroEscritorioId = outro.id;
    const tipo = await tipoStatusRepository.findByChave("nova_conversa");
    tipoStatusId = tipo!.id;
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
  });

  afterAll(async () => {
    await prisma.escritorio.deleteMany({
      where: { id: { in: [escritorioId, outroEscritorioId] } },
    });
    await prisma.$disconnect();
  });

  function criar(
    escritorio: string,
    dados: { nome: string; ordem: number; icone?: string; cor?: string }
  ) {
    return statusRepository.create({
      nome: dados.nome,
      icone: dados.icone ?? "MessageCircle",
      cor: dados.cor ?? "#64748b",
      ordem: dados.ordem,
      escritorio: { connect: { id: escritorio } },
      tipo: { connect: { id: tipoStatusId } },
    });
  }

  it("cria um status vinculado ao escritório e ao tipo", async () => {
    const status = await criar(escritorioId, { nome: "Nova conversa", ordem: 1 });
    expect(status.escritorioId).toBe(escritorioId);
    expect(status.tipoStatusId).toBe(tipoStatusId);
  });

  it("rejeita nome repetido dentro do mesmo escritório", async () => {
    await criar(escritorioId, { nome: "Nova conversa", ordem: 1 });
    await expect(criar(escritorioId, { nome: "Nova conversa", ordem: 2 })).rejects.toThrow();
  });

  it("aceita o mesmo nome em escritórios diferentes", async () => {
    await criar(escritorioId, { nome: "Nova conversa", ordem: 1 });
    const outro = await criar(outroEscritorioId, { nome: "Nova conversa", ordem: 1 });
    expect(outro.escritorioId).toBe(outroEscritorioId);
  });

  it("listar não devolve status de outro escritório (RN19)", async () => {
    await criar(escritorioId, { nome: "Do Tenant", ordem: 1 });
    await criar(outroEscritorioId, { nome: "De Outro Tenant", ordem: 1 });

    const status = await statusRepository.listar(escritorioId);
    expect(status.map((s) => s.nome)).toEqual(["Do Tenant"]);
  });

  it("listar ordena por ordem crescente", async () => {
    await criar(escritorioId, { nome: "Terceiro", ordem: 3 });
    await criar(escritorioId, { nome: "Primeiro", ordem: 1 });
    await criar(escritorioId, { nome: "Segundo", ordem: 2 });

    const status = await statusRepository.listar(escritorioId);
    expect(status.map((s) => s.nome)).toEqual(["Primeiro", "Segundo", "Terceiro"]);
  });

  it("findByNome localiza dentro do escritório e ignora os demais", async () => {
    await criar(outroEscritorioId, { nome: "Nova conversa", ordem: 1 });
    expect(await statusRepository.findByNome(escritorioId, "Nova conversa")).toBeNull();
  });

  it("update altera os campos do status", async () => {
    const status = await criar(escritorioId, { nome: "Original", ordem: 1 });
    const atualizado = await statusRepository.update(status.id, { nome: "Atualizado" });
    expect(atualizado.nome).toBe("Atualizado");
  });

  it("contarCasos conta os casos vinculados ao status", async () => {
    const status = await criar(escritorioId, { nome: "Com Casos", ordem: 1 });
    const cliente = await clienteRepository.create({
      nome: "Cliente Teste",
      cpf: `${Date.now()}`.slice(-11),
      escritorio: { connect: { id: escritorioId } },
    });

    expect(await statusRepository.contarCasos(status.id)).toBe(0);

    await prisma.caso.create({
      data: {
        titulo: "Caso Teste",
        escritorio: { connect: { id: escritorioId } },
        cliente: { connect: { id: cliente.id } },
        status: { connect: { id: status.id } },
      },
    });

    expect(await statusRepository.contarCasos(status.id)).toBe(1);
  });

  it("delete remove o status quando não há casos vinculados", async () => {
    const status = await criar(escritorioId, { nome: "Para Excluir", ordem: 1 });
    await statusRepository.delete(status.id);
    expect(await statusRepository.findById(status.id)).toBeNull();
  });
});
