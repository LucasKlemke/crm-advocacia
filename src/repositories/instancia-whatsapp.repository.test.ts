/**
 * @jest-environment node
 */
import { prisma } from "@/lib/prisma";
import { instanciaWhatsappRepository } from "./instancia-whatsapp.repository";
import { escritorioRepository } from "./escritorio.repository";

describe("instanciaWhatsappRepository", () => {
  let escritorioId: string;
  let outroEscritorioId: string;

  beforeAll(async () => {
    const escritorio = await escritorioRepository.create({ nome: "Escritório Instancia Repo" });
    escritorioId = escritorio.id;
    const outro = await escritorioRepository.create({ nome: "Outro Escritório Instancia Repo" });
    outroEscritorioId = outro.id;
  });

  afterEach(async () => {
    await prisma.instanciaWhatsapp.deleteMany({
      where: { escritorioId: { in: [escritorioId, outroEscritorioId] } },
    });
  });

  afterAll(async () => {
    await prisma.escritorio.deleteMany({
      where: { id: { in: [escritorioId, outroEscritorioId] } },
    });
    await prisma.$disconnect();
  });

  function criar(escritorio: string, nome: string) {
    return instanciaWhatsappRepository.create({
      nome,
      uazapiInstanceId: `instance-${nome}-${escritorio}`,
      uazapiToken: "token-secreto",
      escritorio: { connect: { id: escritorio } },
    });
  }

  it("cria uma instância gravando todos os campos", async () => {
    const instancia = await criar(escritorioId, "Comercial");

    expect(instancia.escritorioId).toBe(escritorioId);
    expect(instancia.nome).toBe("Comercial");
    expect(instancia.uazapiInstanceId).toBe(`instance-Comercial-${escritorioId}`);
    expect(instancia.uazapiToken).toBe("token-secreto");
    expect(instancia.status).toBe("disconnected");
    expect(instancia.numeroConectado).toBeNull();
  });

  it("findById busca pelo id", async () => {
    const instancia = await criar(escritorioId, "Suporte");
    expect(await instanciaWhatsappRepository.findById(instancia.id)).not.toBeNull();
    expect(await instanciaWhatsappRepository.findById("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("findByNome busca dentro do escritório e ignora o de outro tenant", async () => {
    await criar(escritorioId, "Vendas");

    expect(await instanciaWhatsappRepository.findByNome(escritorioId, "Vendas")).not.toBeNull();
    expect(await instanciaWhatsappRepository.findByNome(outroEscritorioId, "Vendas")).toBeNull();
  });

  it("permite o mesmo nome em escritórios diferentes", async () => {
    await criar(escritorioId, "Atendimento");
    await expect(criar(outroEscritorioId, "Atendimento")).resolves.toBeDefined();
  });

  it("recusa nome duplicado dentro do mesmo escritório", async () => {
    await criar(escritorioId, "Atendimento");
    await expect(criar(escritorioId, "Atendimento")).rejects.toThrow();
  });

  it("listar traz só as instâncias do escritório, ordenadas por criação", async () => {
    const primeira = await criar(escritorioId, "Primeira");
    const segunda = await criar(escritorioId, "Segunda");
    await criar(outroEscritorioId, "De Outro Tenant");

    const instancias = await instanciaWhatsappRepository.listar(escritorioId);
    expect(instancias.map((i) => i.id)).toEqual([primeira.id, segunda.id]);
  });

  it("atualizarConexao atualiza status e numeroConectado sem tocar nos demais campos", async () => {
    const instancia = await criar(escritorioId, "Financeiro");

    const atualizada = await instanciaWhatsappRepository.atualizarConexao(instancia.id, {
      status: "connected",
      numeroConectado: "5511999999999",
    });

    expect(atualizada.status).toBe("connected");
    expect(atualizada.numeroConectado).toBe("5511999999999");
    expect(atualizada.nome).toBe("Financeiro");
    expect(atualizada.uazapiInstanceId).toBe(instancia.uazapiInstanceId);
    expect(atualizada.uazapiToken).toBe(instancia.uazapiToken);
    expect(atualizada.escritorioId).toBe(escritorioId);
  });

  it("atualizarConexao grava fotoPerfilUrl quando informado", async () => {
    const instancia = await criar(escritorioId, "Comercial 2");

    const atualizada = await instanciaWhatsappRepository.atualizarConexao(instancia.id, {
      status: "connected",
      numeroConectado: "5511999999999",
      fotoPerfilUrl: "https://pps.whatsapp.net/foto.jpg",
    });

    expect(atualizada.fotoPerfilUrl).toBe("https://pps.whatsapp.net/foto.jpg");
  });

  it("atualizarConexao deixa fotoPerfilUrl intocado quando omitido", async () => {
    const instancia = await criar(escritorioId, "Comercial 3");
    await instanciaWhatsappRepository.atualizarConexao(instancia.id, {
      status: "connected",
      fotoPerfilUrl: "https://pps.whatsapp.net/foto-original.jpg",
    });

    const atualizada = await instanciaWhatsappRepository.atualizarConexao(instancia.id, {
      status: "connecting",
    });

    expect(atualizada.status).toBe("connecting");
    expect(atualizada.fotoPerfilUrl).toBe("https://pps.whatsapp.net/foto-original.jpg");
  });
});
