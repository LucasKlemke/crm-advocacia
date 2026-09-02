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

  it("listar esconde as instâncias soft-deletadas", async () => {
    const ativa = await criar(escritorioId, "Ativa");
    const excluida = await criar(escritorioId, "Excluída");
    await instanciaWhatsappRepository.marcarExcluida(excluida.id, new Date());

    const instancias = await instanciaWhatsappRepository.listar(escritorioId);

    expect(instancias.map((i) => i.id)).toEqual([ativa.id]);
  });

  it("listar com incluirExcluidas traz ativas e excluídas na ordem de criação", async () => {
    const primeira = await criar(escritorioId, "Primeira Ativa");
    const segunda = await criar(escritorioId, "Segunda Excluída");
    await instanciaWhatsappRepository.marcarExcluida(segunda.id, new Date());

    const instancias = await instanciaWhatsappRepository.listar(escritorioId, {
      incluirExcluidas: true,
    });

    expect(instancias.map((i) => i.id)).toEqual([primeira.id, segunda.id]);
  });

  // findById e findByNome não filtram de propósito: é por eles que o Service resolve o
  // token de uma instância soft-deletada (campanha antiga precisa continuar controlável)
  // e detecta o nome ainda reservado por uma excluída.
  it("findById continua encontrando uma instância soft-deletada", async () => {
    const instancia = await criar(escritorioId, "Sumida");
    await instanciaWhatsappRepository.marcarExcluida(instancia.id, new Date());

    const encontrada = await instanciaWhatsappRepository.findById(instancia.id);

    expect(encontrada?.uazapiToken).toBe("token-secreto");
  });

  it("findByNome continua encontrando uma instância soft-deletada", async () => {
    const instancia = await criar(escritorioId, "Reservada");
    await instanciaWhatsappRepository.marcarExcluida(instancia.id, new Date());

    const encontrada = await instanciaWhatsappRepository.findByNome(escritorioId, "Reservada");

    expect(encontrada?.id).toBe(instancia.id);
  });

  it("recusa criar outra instância com o nome de uma soft-deletada", async () => {
    const instancia = await criar(escritorioId, "Nome Queimado");
    await instanciaWhatsappRepository.marcarExcluida(instancia.id, new Date());

    await expect(criar(escritorioId, "Nome Queimado")).rejects.toThrow();
  });

  it("marcarExcluida grava a data sem tocar no token nem no vínculo com a UAZAPI", async () => {
    const instancia = await criar(escritorioId, "Marcada");
    const quando = new Date("2026-03-01T12:00:00.000Z");

    const excluida = await instanciaWhatsappRepository.marcarExcluida(instancia.id, quando);

    expect(excluida.softDeletedAt).toEqual(quando);
    expect(excluida.uazapiToken).toBe(instancia.uazapiToken);
    expect(excluida.uazapiInstanceId).toBe(instancia.uazapiInstanceId);
    expect(excluida.status).toBe(instancia.status);
  });

  it("restaurar zera o softDeletedAt", async () => {
    const instancia = await criar(escritorioId, "Ressuscitada");
    await instanciaWhatsappRepository.marcarExcluida(instancia.id, new Date());

    const restaurada = await instanciaWhatsappRepository.restaurar(instancia.id);

    expect(restaurada.softDeletedAt).toBeNull();
    expect(await instanciaWhatsappRepository.listar(escritorioId)).toHaveLength(1);
  });
});
