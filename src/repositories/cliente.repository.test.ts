/**
 * @jest-environment node
 */
import { prisma } from "@/lib/prisma";
import { clienteRepository } from "./cliente.repository";
import { escritorioRepository } from "./escritorio.repository";

describe("clienteRepository", () => {
  let escritorioId: string;
  let outroEscritorioId: string;

  beforeAll(async () => {
    const escritorio = await escritorioRepository.create({ nome: "Escritório Cliente Repo" });
    escritorioId = escritorio.id;
    const outro = await escritorioRepository.create({ nome: "Outro Escritório Cliente Repo" });
    outroEscritorioId = outro.id;
  });

  afterEach(async () => {
    await prisma.cliente.deleteMany({
      where: { escritorioId: { in: [escritorioId, outroEscritorioId] } },
    });
  });

  afterAll(async () => {
    await prisma.escritorio.deleteMany({
      where: { id: { in: [escritorioId, outroEscritorioId] } },
    });
    await prisma.$disconnect();
  });

  function criar(escritorio: string, dados: { nome: string; cpf: string; email?: string }) {
    return clienteRepository.create({
      ...dados,
      escritorio: { connect: { id: escritorio } },
    });
  }

  it("cria um cliente ativo (sem soft delete)", async () => {
    const cliente = await criar(escritorioId, { nome: "Maria Silva", cpf: "52998224725" });
    expect(cliente.softDeletedAt).toBeNull();
  });

  // RN05: o CPF é único por escritório, não globalmente.
  it("rejeita CPF repetido dentro do mesmo escritório", async () => {
    await criar(escritorioId, { nome: "Maria Silva", cpf: "52998224725" });
    await expect(criar(escritorioId, { nome: "Outra Maria", cpf: "52998224725" })).rejects.toThrow();
  });

  it("aceita o mesmo CPF em escritórios diferentes", async () => {
    await criar(escritorioId, { nome: "Maria Silva", cpf: "52998224725" });
    const outro = await criar(outroEscritorioId, { nome: "Maria Silva", cpf: "52998224725" });
    expect(outro.escritorioId).toBe(outroEscritorioId);
  });

  it("listar não devolve clientes de outro escritório (RN19)", async () => {
    await criar(escritorioId, { nome: "Do Tenant", cpf: "52998224725" });
    await criar(outroEscritorioId, { nome: "De Outro Tenant", cpf: "16899535009" });

    const clientes = await clienteRepository.listar(escritorioId);
    expect(clientes.map((c) => c.nome)).toEqual(["Do Tenant"]);
  });

  it("listar omite os soft-deletados por padrão e os inclui sob demanda", async () => {
    const ativo = await criar(escritorioId, { nome: "Ativo", cpf: "52998224725" });
    const excluido = await criar(escritorioId, { nome: "Excluído", cpf: "16899535009" });
    await clienteRepository.marcarExcluidos([excluido.id], new Date());

    const padrao = await clienteRepository.listar(escritorioId);
    expect(padrao.map((c) => c.id)).toEqual([ativo.id]);

    const comExcluidos = await clienteRepository.listar(escritorioId, { incluirExcluidos: true });
    expect(comExcluidos).toHaveLength(2);
  });

  it("busca por nome é insensível a maiúsculas/minúsculas", async () => {
    await criar(escritorioId, { nome: "Maria Silva", cpf: "52998224725" });
    const encontrados = await clienteRepository.listar(escritorioId, { busca: "mArIa" });
    expect(encontrados).toHaveLength(1);
  });

  it("busca por CPF funciona com máscara digitada", async () => {
    await criar(escritorioId, { nome: "Maria Silva", cpf: "52998224725" });
    const encontrados = await clienteRepository.listar(escritorioId, { busca: "529.982" });
    expect(encontrados).toHaveLength(1);
  });

  it("contar respeita os mesmos filtros da listagem", async () => {
    await criar(escritorioId, { nome: "Maria Silva", cpf: "52998224725" });
    await criar(escritorioId, { nome: "João Souza", cpf: "16899535009" });

    expect(await clienteRepository.contar(escritorioId)).toBe(2);
    expect(await clienteRepository.contar(escritorioId, { busca: "joão" })).toBe(1);
  });

  it("listarPorIds descarta ids que pertencem a outro escritório", async () => {
    const meu = await criar(escritorioId, { nome: "Meu", cpf: "52998224725" });
    const alheio = await criar(outroEscritorioId, { nome: "Alheio", cpf: "16899535009" });

    const encontrados = await clienteRepository.listarPorIds(escritorioId, [meu.id, alheio.id]);
    expect(encontrados.map((c) => c.id)).toEqual([meu.id]);
  });

  it("restaurar zera o soft delete", async () => {
    const cliente = await criar(escritorioId, { nome: "Maria Silva", cpf: "52998224725" });
    await clienteRepository.marcarExcluidos([cliente.id], new Date());
    await clienteRepository.restaurar([cliente.id]);

    const atualizado = await clienteRepository.findById(cliente.id);
    expect(atualizado?.softDeletedAt).toBeNull();
  });

  it("findByCpf localiza dentro do escritório e ignora os demais", async () => {
    await criar(outroEscritorioId, { nome: "Alheio", cpf: "52998224725" });
    expect(await clienteRepository.findByCpf(escritorioId, "52998224725")).toBeNull();
  });
});
