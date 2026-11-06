/**
 * @jest-environment node
 */
import { prisma } from "@dominio/lib/prisma";
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
      softDeletedAt: null,
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

  describe("consultas do sistema (sem sessão)", () => {
    async function criarComStatus(
      nome: string,
      status: "agendada" | "enviando" | "pausada" | "concluida" | "excluindo",
      instancia: string | null = instanciaId
    ) {
      const campanha = await campanhaRepository.create({
        nome,
        mensagemTemplate: "Oi",
        colunaNumero: "numero",
        delayMin: 3,
        delayMax: 6,
        uazapiFolderId: `folder-${nome}`,
        totalDestinatarios: 1,
        status,
        escritorio: { connect: { id: escritorioId } },
        criadoPor: { connect: { id: usuarioId } },
        ...(instancia ? { instancia: { connect: { id: instancia } } } : {}),
      });
      return campanha.id;
    }

    it("listarIdsParaWebhook soma as ativas às encerradas atualizadas desde o corte, só da instância", async () => {
      const instancia = await instanciaWhatsappRepository.create({
        nome: `Webhook ${Date.now()}`,
        uazapiInstanceId: `instance-webhook-${Date.now()}`,
        uazapiToken: "token",
        escritorio: { connect: { id: escritorioId } },
      });
      const outraInstancia = await instanciaWhatsappRepository.create({
        nome: `Webhook outra ${Date.now()}`,
        uazapiInstanceId: `instance-webhook-outra-${Date.now()}`,
        uazapiToken: "token",
        escritorio: { connect: { id: escritorioId } },
      });
      const enviando = await criarComStatus("WhEn", "enviando", instancia.id);
      const pausada = await criarComStatus("WhPa", "pausada", instancia.id);
      const concluidaRecente = await criarComStatus("WhCoRec", "concluida", instancia.id);
      const concluidaAntiga = await criarComStatus("WhCoAnt", "concluida", instancia.id);
      await criarComStatus("WhEx", "excluindo", instancia.id);
      await criarComStatus("WhCoOutra", "concluida", outraInstancia.id);
      const corte = new Date(Date.now() - 24 * 60 * 60 * 1000);
      // @updatedAt aceita valor explícito: simula a campanha encerrada há mais de 24 h.
      await prisma.campanha.update({
        where: { id: concluidaAntiga },
        data: { updatedAt: new Date(corte.getTime() - 60_000) },
      });

      const ids = await campanhaRepository.listarIdsParaWebhook(instancia.id, {
        ativos: ["agendada", "enviando", "pausada"],
        encerrados: ["concluida"],
        atualizadasDesde: corte,
      });

      expect(ids.sort()).toEqual([enviando, pausada, concluidaRecente].sort());
    });

    it("listarIdsParaWebhook não devolve nada quando a instância está soft-deleted", async () => {
      const excluida = await instanciaWhatsappRepository.create({
        nome: `Excluída webhook2 ${Date.now()}`,
        uazapiInstanceId: `instance-excluida-webhook2-${Date.now()}`,
        uazapiToken: "token",
        softDeletedAt: new Date(),
        escritorio: { connect: { id: escritorioId } },
      });
      await criarComStatus("W2En", "enviando", excluida.id);
      await criarComStatus("W2Co", "concluida", excluida.id);

      const ids = await campanhaRepository.listarIdsParaWebhook(excluida.id, {
        ativos: ["agendada", "enviando", "pausada"],
        encerrados: ["concluida"],
        atualizadasDesde: new Date(Date.now() - 60_000),
      });

      expect(ids).toEqual([]);
    });

    it("listarIdsComInstanciaAtiva ignora instância soft-deleted e campanha sem instância", async () => {
      const excluida = await instanciaWhatsappRepository.create({
        nome: `Excluída ${Date.now()}`,
        uazapiInstanceId: `instance-excluida-${Date.now()}`,
        uazapiToken: "token",
        softDeletedAt: new Date(),
        escritorio: { connect: { id: escritorioId } },
      });
      const agendada = await criarComStatus("PAg", "agendada");
      const enviando = await criarComStatus("PEn", "enviando");
      await criarComStatus("PPa", "pausada");
      await criarComStatus("PCo", "concluida");
      await criarComStatus("PDeExcluida", "enviando", excluida.id);
      await criarComStatus("PSemInstancia", "enviando", null);

      const ids = await campanhaRepository.listarIdsComInstanciaAtiva(["agendada", "enviando"]);

      // Consulta global: outras suítes podem ter campanhas no mesmo banco, então a
      // comparação fica restrita às campanhas deste escritório de teste.
      const proprias = await prisma.campanha.findMany({
        where: { escritorioId },
        select: { id: true },
      });
      const idsProprios = new Set(proprias.map((c) => c.id));
      expect(ids.filter((id) => idsProprios.has(id)).sort()).toEqual([agendada, enviando].sort());
    });
  });

  // onDelete: SetNull é a rede de segurança para uma remoção feita FORA da aplicação: o
  // service não apaga mais instância fisicamente (a exclusão é soft), justamente porque
  // zerar este vínculo custa à campanha o token e, com ele, o controle do disparo.
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

    // Direto no Prisma: o repositório não expõe delete físico de propósito.
    await prisma.instanciaWhatsapp.delete({ where: { id: instancia.id } });

    const achada = await campanhaRepository.findById(campanha.id);
    expect(achada).not.toBeNull();
    expect(achada?.instanciaWhatsappId).toBeNull();
  });
});
