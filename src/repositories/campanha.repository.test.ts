/**
 * @jest-environment node
 */
import { prisma } from "@/lib/prisma";
import { campanhaRepository } from "./campanha.repository";
import { escritorioRepository } from "./escritorio.repository";
import { instanciaWhatsappRepository } from "./instancia-whatsapp.repository";
import { usuarioRepository } from "./usuario.repository";

describe("campanhaRepository", () => {
  let escritorioId: string;
  let outroEscritorioId: string;
  let usuarioId: string;
  let instanciaId: string;

  beforeAll(async () => {
    escritorioId = (await escritorioRepository.create({ nome: "Escritório Campanha Repo" })).id;
    outroEscritorioId = (await escritorioRepository.create({ nome: "Outro Campanha Repo" })).id;
    usuarioId = (
      await usuarioRepository.create({
        nome: "Autor Campanha",
        email: `autor-campanha-${Date.now()}@teste.com`,
        senhaHash: "hash",
      })
    ).id;
    instanciaId = (
      await instanciaWhatsappRepository.create({
        nome: "Disparo",
        uazapiInstanceId: `instance-campanha-${Date.now()}`,
        uazapiToken: "token-secreto",
        escritorio: { connect: { id: escritorioId } },
      })
    ).id;
  });

  afterEach(async () => {
    await prisma.campanha.deleteMany({
      where: { escritorioId: { in: [escritorioId, outroEscritorioId] } },
    });
  });

  afterAll(async () => {
    await prisma.instanciaWhatsapp.deleteMany({ where: { escritorioId } });
    await prisma.escritorio.deleteMany({
      where: { id: { in: [escritorioId, outroEscritorioId] } },
    });
    await prisma.usuario.deleteMany({ where: { id: usuarioId } });
    await prisma.$disconnect();
  });

  function criar(escritorio: string, nome: string, folderId = `folder-${nome}`) {
    return campanhaRepository.create({
      nome,
      mensagemTemplate: "Olá {{nome}}",
      mapeamentoVariaveis: { nome: { coluna: "Nome", tratamentos: ["primeiro_nome"] } },
      colunaNumero: "numero",
      delayMin: 3,
      delayMax: 6,
      uazapiFolderId: folderId,
      totalDestinatarios: 2,
      escritorio: { connect: { id: escritorio } },
      criadoPor: { connect: { id: usuarioId } },
      ...(escritorio === escritorioId ? { instancia: { connect: { id: instanciaId } } } : {}),
    });
  }

  it("cria uma campanha gravando todos os campos, com contadores zerados", async () => {
    const campanha = await criar(escritorioId, "Retomada");

    expect(campanha.escritorioId).toBe(escritorioId);
    expect(campanha.instanciaWhatsappId).toBe(instanciaId);
    expect(campanha.criadoPorId).toBe(usuarioId);
    expect(campanha.mensagemTemplate).toBe("Olá {{nome}}");
    expect(campanha.mapeamentoVariaveis).toEqual({
      nome: { coluna: "Nome", tratamentos: ["primeiro_nome"] },
    });
    expect(campanha.uazapiFolderId).toBe("folder-Retomada");
    expect(campanha.status).toBe("agendada");
    expect(campanha.logTotal).toBe(0);
    expect(campanha.logSucesso).toBe(0);
    expect(campanha.sincronizadoEm).toBeNull();
  });

  it("findById traz a instância vinculada, sem o uazapiToken", async () => {
    const campanha = await criar(escritorioId, "Com Instancia");

    const achada = await campanhaRepository.findById(campanha.id);

    expect(achada?.instancia).toEqual({
      id: instanciaId,
      nome: "Disparo",
      status: "disconnected",
    });
    expect(achada?.instancia).not.toHaveProperty("uazapiToken");
  });

  it("findById devolve null para id inexistente", async () => {
    expect(
      await campanhaRepository.findById("00000000-0000-0000-0000-000000000000")
    ).toBeNull();
  });

  it("listar traz só as campanhas do escritório, da mais recente para a mais antiga", async () => {
    const primeira = await criar(escritorioId, "Primeira");
    const segunda = await criar(escritorioId, "Segunda");
    await criar(outroEscritorioId, "De Outro Tenant");

    const campanhas = await campanhaRepository.listar(escritorioId);

    expect(campanhas.map((c) => c.id)).toEqual([segunda.id, primeira.id]);
  });

  it("update altera status e contadores sem tocar nos demais campos", async () => {
    const campanha = await criar(escritorioId, "Sincronizada");

    const atualizada = await campanhaRepository.update(campanha.id, {
      status: "enviando",
      logTotal: 10,
      logSucesso: 7,
    });

    expect(atualizada.status).toBe("enviando");
    expect(atualizada.logTotal).toBe(10);
    expect(atualizada.logSucesso).toBe(7);
    expect(atualizada.nome).toBe("Sincronizada");
    expect(atualizada.uazapiFolderId).toBe(campanha.uazapiFolderId);
  });

  it("delete remove a campanha", async () => {
    const campanha = await criar(escritorioId, "Descartada");

    await campanhaRepository.delete(campanha.id);

    expect(await campanhaRepository.findById(campanha.id)).toBeNull();
  });

  // onDelete: SetNull — sincronizarTodas apaga instâncias fantasma, e a campanha precisa
  // sobreviver a isso como histórico em vez de bloquear a limpeza.
  it("mantém a campanha e zera o vínculo quando a instância é excluída", async () => {
    const instancia = await instanciaWhatsappRepository.create({
      nome: "Efêmera",
      uazapiInstanceId: `instance-efemera-${Date.now()}`,
      uazapiToken: "token-secreto",
      escritorio: { connect: { id: escritorioId } },
    });
    const campanha = await campanhaRepository.create({
      nome: "Órfã",
      mensagemTemplate: "Oi",
      colunaNumero: "numero",
      delayMin: 3,
      delayMax: 6,
      uazapiFolderId: "folder-orfa",
      totalDestinatarios: 1,
      escritorio: { connect: { id: escritorioId } },
      criadoPor: { connect: { id: usuarioId } },
      instancia: { connect: { id: instancia.id } },
    });

    await instanciaWhatsappRepository.delete(instancia.id);

    const achada = await campanhaRepository.findById(campanha.id);
    expect(achada).not.toBeNull();
    expect(achada?.instanciaWhatsappId).toBeNull();
  });
});
