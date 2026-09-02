/**
 * @jest-environment node
 */
import { prisma } from "@/lib/prisma";
import { eventoRepository } from "./evento.repository";
import { escritorioRepository } from "./escritorio.repository";

// Datas fixas: a janela consultada é sempre setembro/2026, então cada caso de teste
// posiciona o evento explicitamente dentro, fora ou cruzando a borda dela.
const JANELA = {
  inicio: new Date("2026-09-01T00:00:00.000Z"),
  fim: new Date("2026-09-30T23:59:59.999Z"),
};

describe("eventoRepository", () => {
  let escritorioId: string;
  let outroEscritorioId: string;
  let membroId: string;
  let outroMembroId: string;

  beforeAll(async () => {
    const escritorio = await escritorioRepository.create({ nome: "Escritório Evento Repo" });
    escritorioId = escritorio.id;
    const outro = await escritorioRepository.create({ nome: "Outro Escritório Evento Repo" });
    outroEscritorioId = outro.id;

    const usuario = await prisma.usuario.create({
      data: {
        nome: "Advogado Evento",
        email: `evento-repo-${Date.now()}@teste.com`,
        senhaHash: "hash",
      },
    });
    const outroUsuario = await prisma.usuario.create({
      data: {
        nome: "Colaborador Evento",
        email: `evento-repo-2-${Date.now()}@teste.com`,
        senhaHash: "hash",
      },
    });
    const membro = await prisma.membro.create({
      data: { usuarioId: usuario.id, escritorioId, role: "owner" },
    });
    membroId = membro.id;
    const outroMembro = await prisma.membro.create({
      data: { usuarioId: outroUsuario.id, escritorioId, role: "padrao" },
    });
    outroMembroId = outroMembro.id;
  });

  afterEach(async () => {
    await prisma.evento.deleteMany({
      where: { escritorioId: { in: [escritorioId, outroEscritorioId] } },
    });
  });

  afterAll(async () => {
    await prisma.membro.deleteMany({ where: { escritorioId } });
    await prisma.usuario.deleteMany({ where: { email: { contains: "evento-repo" } } });
    await prisma.escritorio.deleteMany({
      where: { id: { in: [escritorioId, outroEscritorioId] } },
    });
    await prisma.$disconnect();
  });

  function criar(
    escritorio: string,
    dados: { titulo: string; inicio: string; fim: string; criadoPor?: string }
  ) {
    return eventoRepository.create({
      titulo: dados.titulo,
      inicio: new Date(dados.inicio),
      fim: new Date(dados.fim),
      modalidade: "presencial",
      local: "Sala 1",
      escritorio: { connect: { id: escritorio } },
      criadoPor: { connect: { id: dados.criadoPor ?? membroId } },
    });
  }

  it("cria um evento vinculado ao escritório e ao membro criador", async () => {
    const evento = await criar(escritorioId, {
      titulo: "Audiência",
      inicio: "2026-09-10T13:00:00.000Z",
      fim: "2026-09-10T14:00:00.000Z",
    });
    expect(evento.escritorioId).toBe(escritorioId);
    expect(evento.criadoPorMembroId).toBe(membroId);
    expect(evento.diaInteiro).toBe(false);
    expect(evento.softDeletedAt).toBeNull();
  });

  it("listarNoPeriodo traz só eventos do escritório da sessão (RN19)", async () => {
    await criar(escritorioId, {
      titulo: "Meu evento",
      inicio: "2026-09-10T13:00:00.000Z",
      fim: "2026-09-10T14:00:00.000Z",
    });
    await eventoRepository.create({
      titulo: "Evento do vizinho",
      inicio: new Date("2026-09-11T13:00:00.000Z"),
      fim: new Date("2026-09-11T14:00:00.000Z"),
      modalidade: "online",
      linkReuniao: "https://meet.example.com/x",
      escritorio: { connect: { id: outroEscritorioId } },
      criadoPor: { connect: { id: membroId } },
    });

    const eventos = await eventoRepository.listarNoPeriodo(escritorioId, JANELA);
    expect(eventos).toHaveLength(1);
    expect(eventos[0].titulo).toBe("Meu evento");
  });

  it("listarNoPeriodo inclui evento que só cruza a borda da janela", async () => {
    // Começa em agosto e termina em setembro: precisa aparecer na visão de setembro.
    await criar(escritorioId, {
      titulo: "Cruza a entrada",
      inicio: "2026-08-31T20:00:00.000Z",
      fim: "2026-09-01T02:00:00.000Z",
    });
    // Começa no último dia de setembro e termina em outubro.
    await criar(escritorioId, {
      titulo: "Cruza a saída",
      inicio: "2026-09-30T22:00:00.000Z",
      fim: "2026-10-01T03:00:00.000Z",
    });
    // Inteiramente fora: não pode aparecer.
    await criar(escritorioId, {
      titulo: "Fora",
      inicio: "2026-10-05T10:00:00.000Z",
      fim: "2026-10-05T11:00:00.000Z",
    });

    const titulos = (await eventoRepository.listarNoPeriodo(escritorioId, JANELA)).map(
      (e) => e.titulo
    );
    expect(titulos).toEqual(["Cruza a entrada", "Cruza a saída"]);
  });

  it("listarNoPeriodo ordena por início ascendente", async () => {
    await criar(escritorioId, {
      titulo: "Tarde",
      inicio: "2026-09-10T18:00:00.000Z",
      fim: "2026-09-10T19:00:00.000Z",
    });
    await criar(escritorioId, {
      titulo: "Manhã",
      inicio: "2026-09-10T11:00:00.000Z",
      fim: "2026-09-10T12:00:00.000Z",
    });

    const titulos = (await eventoRepository.listarNoPeriodo(escritorioId, JANELA)).map(
      (e) => e.titulo
    );
    expect(titulos).toEqual(["Manhã", "Tarde"]);
  });

  it("listarNoPeriodo esconde evento com soft delete (RN34)", async () => {
    const evento = await criar(escritorioId, {
      titulo: "Cancelado",
      inicio: "2026-09-10T13:00:00.000Z",
      fim: "2026-09-10T14:00:00.000Z",
    });
    await eventoRepository.softDelete(evento.id);

    expect(await eventoRepository.listarNoPeriodo(escritorioId, JANELA)).toHaveLength(0);
    const apagado = await eventoRepository.findById(evento.id);
    expect(apagado?.softDeletedAt).not.toBeNull();
  });

  it("findById traz criador e participantes hidratados", async () => {
    const evento = await criar(escritorioId, {
      titulo: "Reunião",
      inicio: "2026-09-12T13:00:00.000Z",
      fim: "2026-09-12T14:00:00.000Z",
    });
    await eventoRepository.substituirParticipantes(evento.id, [membroId, outroMembroId]);

    const carregado = await eventoRepository.findById(evento.id);
    expect(carregado?.criadoPor.usuario.nome).toBe("Advogado Evento");
    expect(carregado?.participantes.map((p) => p.membroId).sort()).toEqual(
      [membroId, outroMembroId].sort()
    );
  });

  it("substituirParticipantes troca o conjunto inteiro, sem duplicar", async () => {
    const evento = await criar(escritorioId, {
      titulo: "Reunião",
      inicio: "2026-09-12T13:00:00.000Z",
      fim: "2026-09-12T14:00:00.000Z",
    });
    await eventoRepository.substituirParticipantes(evento.id, [membroId, outroMembroId]);
    await eventoRepository.substituirParticipantes(evento.id, [outroMembroId]);

    const carregado = await eventoRepository.findById(evento.id);
    expect(carregado?.participantes.map((p) => p.membroId)).toEqual([outroMembroId]);
  });

  it("substituirParticipantes com lista vazia limpa o evento", async () => {
    const evento = await criar(escritorioId, {
      titulo: "Reunião",
      inicio: "2026-09-12T13:00:00.000Z",
      fim: "2026-09-12T14:00:00.000Z",
    });
    await eventoRepository.substituirParticipantes(evento.id, [membroId]);
    await eventoRepository.substituirParticipantes(evento.id, []);

    const carregado = await eventoRepository.findById(evento.id);
    expect(carregado?.participantes).toEqual([]);
  });

  it("substituirParticipantes deduplica ids repetidos no mesmo pedido", async () => {
    const evento = await criar(escritorioId, {
      titulo: "Reunião",
      inicio: "2026-09-12T13:00:00.000Z",
      fim: "2026-09-12T14:00:00.000Z",
    });
    // A unique (evento_id, membro_id) rejeitaria o insert duplicado; a dedup evita que
    // um payload repetido derrube a transação inteira.
    await eventoRepository.substituirParticipantes(evento.id, [membroId, membroId]);

    const carregado = await eventoRepository.findById(evento.id);
    expect(carregado?.participantes).toHaveLength(1);
  });

  it("conta eventos ativos por caso e por cliente, ignorando os excluídos", async () => {
    const cliente = await prisma.cliente.create({
      data: { escritorioId, nome: "Cliente Evento", cpf: `${Date.now()}`.slice(-11) },
    });
    const evento = await eventoRepository.create({
      titulo: "Com cliente",
      inicio: new Date("2026-09-10T13:00:00.000Z"),
      fim: new Date("2026-09-10T14:00:00.000Z"),
      modalidade: "presencial",
      local: "Sala 1",
      escritorio: { connect: { id: escritorioId } },
      criadoPor: { connect: { id: membroId } },
      cliente: { connect: { id: cliente.id } },
    });

    expect(await eventoRepository.contarPorCliente(cliente.id)).toBe(1);
    expect(await eventoRepository.contarPorCaso(cliente.id)).toBe(0);

    await eventoRepository.softDelete(evento.id);
    expect(await eventoRepository.contarPorCliente(cliente.id)).toBe(0);

    await prisma.evento.deleteMany({ where: { clienteId: cliente.id } });
    await prisma.cliente.delete({ where: { id: cliente.id } });
  });

  it("update altera os campos e mantém o escritório", async () => {
    const evento = await criar(escritorioId, {
      titulo: "Antes",
      inicio: "2026-09-10T13:00:00.000Z",
      fim: "2026-09-10T14:00:00.000Z",
    });
    const atualizado = await eventoRepository.update(evento.id, {
      titulo: "Depois",
      modalidade: "online",
      local: null,
      linkReuniao: "https://meet.example.com/y",
    });
    expect(atualizado.titulo).toBe("Depois");
    expect(atualizado.local).toBeNull();
    expect(atualizado.escritorioId).toBe(escritorioId);
  });
});
