/**
 * @jest-environment node
 */
import { prisma } from "@/lib/prisma";
import { campanhaItemRepository } from "./campanha-item.repository";
import { campanhaRepository } from "./campanha.repository";
import { escritorioRepository } from "./escritorio.repository";
import { usuarioRepository } from "./usuario.repository";

describe("campanhaItemRepository", () => {
  let escritorioId: string;
  let usuarioId: string;
  let campanhaId: string;

  beforeAll(async () => {
    escritorioId = (await escritorioRepository.create({ nome: "Escritório Item Repo" })).id;
    usuarioId = (
      await usuarioRepository.create({
        nome: "Autor Item",
        email: `autor-item-${Date.now()}@teste.com`,
        senhaHash: "hash",
      })
    ).id;
  });

  beforeEach(async () => {
    campanhaId = (
      await campanhaRepository.create({
        nome: "Campanha com itens",
        mensagemTemplate: "Olá {{nome}}",
        colunaNumero: "numero",
        delayMin: 3,
        delayMax: 6,
        uazapiFolderId: `folder-${Date.now()}`,
        totalDestinatarios: 3,
        escritorio: { connect: { id: escritorioId } },
        criadoPor: { connect: { id: usuarioId } },
      })
    ).id;
  });

  afterEach(async () => {
    await prisma.campanha.deleteMany({ where: { escritorioId } });
  });

  afterAll(async () => {
    await prisma.escritorio.deleteMany({ where: { id: escritorioId } });
    await prisma.usuario.deleteMany({ where: { id: usuarioId } });
    await prisma.$disconnect();
  });

  function itens(quantidade: number) {
    return Array.from({ length: quantidade }, (_, indice) => ({
      escritorioId,
      campanhaId,
      linha: indice + 1,
      numero: `551199999${String(indice).padStart(4, "0")}`,
      mensagem: `Olá contato ${indice + 1}`,
      variaveis: { nome: `Contato ${indice + 1}` },
    }));
  }

  it("createMany grava o lote e devolve a quantidade inserida", async () => {
    expect(await campanhaItemRepository.createMany(itens(3))).toBe(3);
    expect(await campanhaItemRepository.contarPorCampanha(campanhaId)).toBe(3);
  });

  it("recusa duas linhas com o mesmo número dentro da campanha", async () => {
    await campanhaItemRepository.createMany(itens(2));

    await expect(
      campanhaItemRepository.createMany([
        {
          escritorioId,
          campanhaId,
          linha: 1,
          numero: "5511999990000",
          mensagem: "Duplicada",
        },
      ])
    ).rejects.toThrow();
  });

  it("listarPorCampanha pagina em ordem de linha", async () => {
    await campanhaItemRepository.createMany(itens(5));

    const pagina = await campanhaItemRepository.listarPorCampanha(campanhaId, {
      pular: 2,
      limite: 2,
    });

    expect(pagina.map((item) => item.linha)).toEqual([3, 4]);
    expect(pagina[0].variaveis).toEqual({ nome: "Contato 3" });
  });

  it("contarPorCampanha conta só os itens daquela campanha", async () => {
    await campanhaItemRepository.createMany(itens(3));
    const outra = await campanhaRepository.create({
      nome: "Outra campanha",
      mensagemTemplate: "Oi",
      colunaNumero: "numero",
      delayMin: 3,
      delayMax: 6,
      uazapiFolderId: `folder-outra-${Date.now()}`,
      totalDestinatarios: 1,
      escritorio: { connect: { id: escritorioId } },
      criadoPor: { connect: { id: usuarioId } },
    });
    await campanhaItemRepository.createMany([
      {
        escritorioId,
        campanhaId: outra.id,
        linha: 1,
        numero: "5511988887777",
        mensagem: "De outra campanha",
      },
    ]);

    expect(await campanhaItemRepository.contarPorCampanha(campanhaId)).toBe(3);
    expect(await campanhaItemRepository.contarPorCampanha(outra.id)).toBe(1);
  });

  // onDelete: Cascade — excluir a campanha leva os itens junto, sem sobra órfã.
  it("os itens somem quando a campanha é excluída", async () => {
    await campanhaItemRepository.createMany(itens(3));

    await campanhaRepository.delete(campanhaId);

    expect(await campanhaItemRepository.contarPorCampanha(campanhaId)).toBe(0);
  });
});
