/**
 * @jest-environment node
 */
import { prisma } from "@/lib/prisma";
import { logRepository } from "./log.repository";
import { escritorioRepository } from "./escritorio.repository";
import { usuarioRepository } from "./usuario.repository";

describe("logRepository", () => {
  let escritorioId: string;
  let outroEscritorioId: string;
  let usuarioId: string;

  beforeAll(async () => {
    escritorioId = (await escritorioRepository.create({ nome: "Escritório Log Repo" })).id;
    outroEscritorioId = (await escritorioRepository.create({ nome: "Outro Log Repo" })).id;
    usuarioId = (
      await usuarioRepository.create({
        nome: "Autor do Log",
        email: `autor-log-${Date.now()}@teste.com`,
        senhaHash: "hash",
      })
    ).id;
  });

  afterEach(async () => {
    await prisma.log.deleteMany({
      where: { escritorioId: { in: [escritorioId, outroEscritorioId] } },
    });
  });

  afterAll(async () => {
    await prisma.escritorio.deleteMany({
      where: { id: { in: [escritorioId, outroEscritorioId] } },
    });
    await prisma.usuario.delete({ where: { id: usuarioId } });
    await prisma.$disconnect();
  });

  function registrar(escritorio: string, entidadeId: string, resumo: string, dados?: object) {
    return logRepository.create({
      acao: "atualizar",
      entidade: "cliente",
      entidadeId,
      resumo,
      ...(dados ? { dados } : {}),
      escritorio: { connect: { id: escritorio } },
      usuario: { connect: { id: usuarioId } },
    });
  }

  it("guarda quem fez, quando fez e o que fez", async () => {
    const antes = Date.now();
    const log = await registrar(escritorioId, "cliente-1", "Cliente Maria Silva atualizado");

    expect(log.usuarioId).toBe(usuarioId);
    expect(log.createdAt.getTime()).toBeGreaterThanOrEqual(antes - 1000);
    expect(log.acao).toBe("atualizar");
    expect(log.entidade).toBe("cliente");
    expect(log.entidadeId).toBe("cliente-1");
  });

  it("persiste o diff em dados", async () => {
    const log = await registrar(escritorioId, "cliente-1", "Cliente atualizado", {
      telefone: { antes: "48999990000", depois: "48988887777" },
    });
    expect(log.dados).toEqual({ telefone: { antes: "48999990000", depois: "48988887777" } });
  });

  it("listarPorEntidade traz só os logs daquela entidade, do mais novo ao mais antigo", async () => {
    await registrar(escritorioId, "cliente-1", "Primeiro");
    await new Promise((resolve) => setTimeout(resolve, 5));
    await registrar(escritorioId, "cliente-1", "Segundo");
    await registrar(escritorioId, "cliente-2", "De outro cliente");

    const logs = await logRepository.listarPorEntidade(escritorioId, "cliente", "cliente-1");
    expect(logs.map((l) => l.resumo)).toEqual(["Segundo", "Primeiro"]);
    expect(logs[0].usuario.nome).toBe("Autor do Log");
  });

  it("não devolve logs de outro escritório (RN19)", async () => {
    await registrar(outroEscritorioId, "cliente-1", "De outro tenant");
    const logs = await logRepository.listarPorEntidade(escritorioId, "cliente", "cliente-1");
    expect(logs).toHaveLength(0);
  });
});

describe("logRepository dentro de uma transação", () => {
  it("grava usando o cliente da transação recebido", async () => {
    let escritorioTx: string;
    let usuarioTx: string;

    const criados = await prisma.$transaction(async (tx) => {
      const escritorio = await tx.escritorio.create({ data: { nome: "Escritório Log Tx" } });
      const usuario = await tx.usuario.create({
        data: {
          nome: "Autor Tx",
          email: `autor-log-tx-${Date.now()}@teste.com`,
          senhaHash: "hash",
        },
      });
      escritorioTx = escritorio.id;
      usuarioTx = usuario.id;

      return logRepository.create(
        {
          acao: "criar",
          entidade: "cliente",
          entidadeId: "cliente-tx",
          resumo: "Criado dentro da transação",
          escritorio: { connect: { id: escritorio.id } },
          usuario: { connect: { id: usuario.id } },
        },
        tx
      );
    });

    expect(criados.entidadeId).toBe("cliente-tx");

    await prisma.log.delete({ where: { id: criados.id } });
    await prisma.escritorio.delete({ where: { id: escritorioTx! } });
    await prisma.usuario.delete({ where: { id: usuarioTx! } });
  });
});
