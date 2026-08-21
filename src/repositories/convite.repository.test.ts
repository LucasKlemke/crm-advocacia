/**
 * @jest-environment node
 */
import { prisma } from "@/lib/prisma";
import { conviteRepository } from "./convite.repository";
import { escritorioRepository } from "./escritorio.repository";
import { usuarioRepository } from "./usuario.repository";

describe("conviteRepository", () => {
  let escritorioId: string;
  let usuarioId: string;
  const convitesCriados: string[] = [];

  beforeAll(async () => {
    const escritorio = await escritorioRepository.create({ nome: "Escritório Convite Repo" });
    escritorioId = escritorio.id;
    const usuario = await usuarioRepository.create({
      nome: "Criador Convite",
      email: `criador-convite-${Date.now()}@teste.com`,
      senhaHash: "hash",
    });
    usuarioId = usuario.id;
  });

  afterEach(async () => {
    if (convitesCriados.length) {
      await prisma.convite.deleteMany({ where: { id: { in: convitesCriados } } });
      convitesCriados.length = 0;
    }
  });

  afterAll(async () => {
    await prisma.escritorio.delete({ where: { id: escritorioId } });
    await prisma.usuario.delete({ where: { id: usuarioId } });
    await prisma.$disconnect();
  });

  it("cria um convite com e-mail normalizado", async () => {
    const convite = await conviteRepository.create({
      email: "  Convidado@Teste.COM  ",
      escritorio: { connect: { id: escritorioId } },
      criadoPor: { connect: { id: usuarioId } },
    });
    convitesCriados.push(convite.id);

    expect(convite.email).toBe("convidado@teste.com");
    expect(convite.role).toBe("padrao");
  });

  it("define expiraEm com 7 dias de validade por padrão", async () => {
    const antes = Date.now();
    const convite = await conviteRepository.create({
      email: `expiracao-${Date.now()}@teste.com`,
      escritorio: { connect: { id: escritorioId } },
      criadoPor: { connect: { id: usuarioId } },
    });
    convitesCriados.push(convite.id);

    const seteDiasMs = 7 * 24 * 60 * 60 * 1000;
    expect(convite.expiraEm.getTime()).toBeGreaterThanOrEqual(antes + seteDiasMs - 1000);
    expect(convite.expiraEm.getTime()).toBeLessThanOrEqual(Date.now() + seteDiasMs + 1000);
  });

  it("busca por id", async () => {
    const criado = await conviteRepository.create({
      email: `busca-id-${Date.now()}@teste.com`,
      escritorio: { connect: { id: escritorioId } },
      criadoPor: { connect: { id: usuarioId } },
    });
    convitesCriados.push(criado.id);

    const encontrado = await conviteRepository.findById(criado.id);

    expect(encontrado?.id).toBe(criado.id);
  });

  it("retorna null ao buscar id inexistente", async () => {
    const encontrado = await conviteRepository.findById("00000000-0000-0000-0000-000000000000");
    expect(encontrado).toBeNull();
  });

  it("busca convite por escritório e e-mail", async () => {
    const email = `escritorio-email-${Date.now()}@teste.com`;
    const criado = await conviteRepository.create({
      email,
      escritorio: { connect: { id: escritorioId } },
      criadoPor: { connect: { id: usuarioId } },
    });
    convitesCriados.push(criado.id);

    const encontrado = await conviteRepository.findByEscritorioEEmail(escritorioId, email);

    expect(encontrado?.id).toBe(criado.id);
  });

  it("lista convites pendentes por e-mail", async () => {
    const email = `pendente-${Date.now()}@teste.com`;
    const criado = await conviteRepository.create({
      email,
      escritorio: { connect: { id: escritorioId } },
      criadoPor: { connect: { id: usuarioId } },
    });
    convitesCriados.push(criado.id);

    const lista = await conviteRepository.listarPorEmail(email);

    expect(lista.map((c) => c.id)).toEqual([criado.id]);
  });

  it("lista convites por escritório", async () => {
    const criado = await conviteRepository.create({
      email: `por-escritorio-${Date.now()}@teste.com`,
      escritorio: { connect: { id: escritorioId } },
      criadoPor: { connect: { id: usuarioId } },
    });
    convitesCriados.push(criado.id);

    const lista = await conviteRepository.listarPorEscritorio(escritorioId);

    expect(lista.some((c) => c.id === criado.id)).toBe(true);
  });

  it("lista como pendente apenas o convite dentro do prazo", async () => {
    const valido = await conviteRepository.create({
      email: `pendente-valido-${Date.now()}@teste.com`,
      escritorio: { connect: { id: escritorioId } },
      criadoPor: { connect: { id: usuarioId } },
    });
    convitesCriados.push(valido.id);

    const expirado = await conviteRepository.create({
      email: `pendente-expirado-${Date.now()}@teste.com`,
      escritorio: { connect: { id: escritorioId } },
      criadoPor: { connect: { id: usuarioId } },
      expiraEm: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    convitesCriados.push(expirado.id);

    const pendentes = await conviteRepository.listarPendentesPorEscritorio(escritorioId);

    expect(pendentes.some((c) => c.id === valido.id)).toBe(true);
    expect(pendentes.some((c) => c.id === expirado.id)).toBe(false);
    // a listagem crua continua enxergando os dois
    const todos = await conviteRepository.listarPorEscritorio(escritorioId);
    expect(todos.some((c) => c.id === expirado.id)).toBe(true);
  });

  it("remove um convite", async () => {
    const criado = await conviteRepository.create({
      email: `remover-${Date.now()}@teste.com`,
      escritorio: { connect: { id: escritorioId } },
      criadoPor: { connect: { id: usuarioId } },
    });

    await conviteRepository.remover(criado.id);

    const encontrado = await conviteRepository.findById(criado.id);
    expect(encontrado).toBeNull();
  });

  it("remove todos os convites pendentes de um e-mail", async () => {
    const email = `remover-todos-${Date.now()}@teste.com`;
    const escritorio2 = await escritorioRepository.create({ nome: "Escritório Convite Repo 2" });
    await conviteRepository.create({
      email,
      escritorio: { connect: { id: escritorioId } },
      criadoPor: { connect: { id: usuarioId } },
    });
    await conviteRepository.create({
      email,
      escritorio: { connect: { id: escritorio2.id } },
      criadoPor: { connect: { id: usuarioId } },
    });

    await conviteRepository.removerTodosPorEmail(email);

    const lista = await conviteRepository.listarPorEmail(email);
    expect(lista).toHaveLength(0);
    await prisma.escritorio.delete({ where: { id: escritorio2.id } });
  });
});
