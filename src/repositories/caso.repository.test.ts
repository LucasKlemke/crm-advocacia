/**
 * @jest-environment node
 */
import { prisma } from "@/lib/prisma";
import { casoRepository, SEM_RESPONSAVEL } from "./caso.repository";
import { escritorioRepository } from "./escritorio.repository";
import { clienteRepository } from "./cliente.repository";
import { statusRepository } from "./status.repository";
import { tipoStatusRepository } from "./tipo-status.repository";
import { membroRepository } from "./membro.repository";
import { usuarioRepository } from "./usuario.repository";

describe("casoRepository", () => {
  let escritorioId: string;
  let outroEscritorioId: string;
  let clienteId: string;
  let statusId: string;
  let outroStatusId: string;
  let membroId: string;

  beforeAll(async () => {
    const escritorio = await escritorioRepository.create({ nome: "Escritório Caso Repo" });
    escritorioId = escritorio.id;
    const outro = await escritorioRepository.create({ nome: "Outro Escritório Caso Repo" });
    outroEscritorioId = outro.id;

    const cliente = await clienteRepository.create({
      nome: "Cliente Caso Repo",
      cpf: "52998224725",
      escritorio: { connect: { id: escritorioId } },
    });
    clienteId = cliente.id;

    const tipo1 = await tipoStatusRepository.findByChave("lead");
    const tipo2 = await tipoStatusRepository.findByChave("negociacao");

    const status = await statusRepository.create({
      nome: "Status Caso Repo",
      icone: "MessageCircle",
      cor: "#64748b",
      ordem: 1,
      escritorio: { connect: { id: escritorioId } },
      tipo: { connect: { id: tipo1!.id } },
    });
    statusId = status.id;

    const outroStatus = await statusRepository.create({
      nome: "Outro Status Caso Repo",
      icone: "Search",
      cor: "#f59e0b",
      ordem: 2,
      escritorio: { connect: { id: escritorioId } },
      tipo: { connect: { id: tipo2!.id } },
    });
    outroStatusId = outroStatus.id;

    const usuario = await usuarioRepository.create({
      nome: "Usuario Caso Repo",
      email: `usuario-caso-repo-${Date.now()}@teste.com`,
      senhaHash: "hash",
    });

    const membro = await membroRepository.create({
      usuario: { connect: { id: usuario.id } },
      escritorio: { connect: { id: escritorioId } },
    });
    membroId = membro.id;
  });

  afterEach(async () => {
    await prisma.caso.deleteMany({
      where: { escritorioId: { in: [escritorioId, outroEscritorioId] } },
    });
  });

  afterAll(async () => {
    await prisma.membro.deleteMany({ where: { id: membroId } });
    await prisma.status.deleteMany({
      where: { escritorioId: { in: [escritorioId, outroEscritorioId] } },
    });
    await prisma.cliente.deleteMany({
      where: { escritorioId: { in: [escritorioId, outroEscritorioId] } },
    });
    await prisma.escritorio.deleteMany({
      where: { id: { in: [escritorioId, outroEscritorioId] } },
    });
    await prisma.$disconnect();
  });

  function criar(
    escritorio: string,
    dados: {
      titulo: string;
      cliente: string;
      status: string;
      responsavel?: string;
      arquivado?: boolean;
      valor?: number;
    }
  ) {
    return casoRepository.create({
      titulo: dados.titulo,
      arquivado: dados.arquivado ?? false,
      escritorio: { connect: { id: escritorio } },
      cliente: { connect: { id: dados.cliente } },
      status: { connect: { id: dados.status } },
      ...(dados.responsavel ? { responsavel: { connect: { id: dados.responsavel } } } : {}),
      ...(dados.valor !== undefined ? { valor: dados.valor } : {}),
    });
  }

  it("cria um caso vinculado ao escritório, cliente e status", async () => {
    const caso = await criar(escritorioId, { titulo: "Caso 1", cliente: clienteId, status: statusId });
    expect(caso.escritorioId).toBe(escritorioId);
    expect(caso.clienteId).toBe(clienteId);
    expect(caso.statusId).toBe(statusId);
    expect(caso.arquivado).toBe(false);
  });

  it("findById inclui cliente, status e responsavel", async () => {
    const caso = await criar(escritorioId, {
      titulo: "Caso Com Responsável",
      cliente: clienteId,
      status: statusId,
      responsavel: membroId,
    });

    const encontrado = await casoRepository.findById(caso.id);
    expect(encontrado?.cliente.id).toBe(clienteId);
    expect(encontrado?.status.id).toBe(statusId);
    expect(encontrado?.responsavel?.id).toBe(membroId);
    expect(encontrado?.responsavel?.usuario).toBeDefined();
  });

  it("listar não devolve casos de outro escritório (RN19)", async () => {
    await criar(escritorioId, { titulo: "Do Tenant", cliente: clienteId, status: statusId });

    const outroCliente = await clienteRepository.create({
      nome: "Cliente Outro Tenant",
      cpf: "16899535009",
      escritorio: { connect: { id: outroEscritorioId } },
    });
    const outroTipo = await tipoStatusRepository.findByChave("lead");
    const outroStatusOutroTenant = await statusRepository.create({
      nome: "Status Outro Tenant",
      icone: "MessageCircle",
      cor: "#64748b",
      ordem: 1,
      escritorio: { connect: { id: outroEscritorioId } },
      tipo: { connect: { id: outroTipo!.id } },
    });
    await criar(outroEscritorioId, {
      titulo: "De Outro Tenant",
      cliente: outroCliente.id,
      status: outroStatusOutroTenant.id,
    });

    const casos = await casoRepository.listar(escritorioId);
    expect(casos.map((c) => c.titulo)).toEqual(["Do Tenant"]);

    await prisma.caso.deleteMany({ where: { escritorioId: outroEscritorioId } });
    await prisma.status.delete({ where: { id: outroStatusOutroTenant.id } });
    await prisma.cliente.delete({ where: { id: outroCliente.id } });
  });

  it("listar por padrão esconde casos arquivados", async () => {
    await criar(escritorioId, { titulo: "Ativo", cliente: clienteId, status: statusId });
    await criar(escritorioId, {
      titulo: "Arquivado",
      cliente: clienteId,
      status: statusId,
      arquivado: true,
    });

    const casos = await casoRepository.listar(escritorioId);
    expect(casos.map((c) => c.titulo)).toEqual(["Ativo"]);
  });

  it("listar com arquivado:true devolve só os arquivados", async () => {
    await criar(escritorioId, { titulo: "Ativo", cliente: clienteId, status: statusId });
    await criar(escritorioId, {
      titulo: "Arquivado",
      cliente: clienteId,
      status: statusId,
      arquivado: true,
    });

    const casos = await casoRepository.listar(escritorioId, { arquivado: true });
    expect(casos.map((c) => c.titulo)).toEqual(["Arquivado"]);
  });

  it("filtra por busca no título e descrição", async () => {
    await criar(escritorioId, { titulo: "Ação de cobrança", cliente: clienteId, status: statusId });
    await criar(escritorioId, { titulo: "Divórcio", cliente: clienteId, status: statusId });

    const casos = await casoRepository.listar(escritorioId, { busca: "cobrança" });
    expect(casos.map((c) => c.titulo)).toEqual(["Ação de cobrança"]);
  });

  it("filtra por statusIds", async () => {
    await criar(escritorioId, { titulo: "No status 1", cliente: clienteId, status: statusId });
    await criar(escritorioId, { titulo: "No status 2", cliente: clienteId, status: outroStatusId });

    const casos = await casoRepository.listar(escritorioId, { statusIds: [statusId] });
    expect(casos.map((c) => c.titulo)).toEqual(["No status 1"]);
  });

  it("filtra por responsavelIds incluindo o sentinela de sem responsável", async () => {
    await criar(escritorioId, {
      titulo: "Com Responsável",
      cliente: clienteId,
      status: statusId,
      responsavel: membroId,
    });
    await criar(escritorioId, { titulo: "Sem Responsável", cliente: clienteId, status: statusId });

    const semResponsavel = await casoRepository.listar(escritorioId, {
      responsavelIds: [SEM_RESPONSAVEL],
    });
    expect(semResponsavel.map((c) => c.titulo)).toEqual(["Sem Responsável"]);

    const comResponsavel = await casoRepository.listar(escritorioId, {
      responsavelIds: [membroId],
    });
    expect(comResponsavel.map((c) => c.titulo)).toEqual(["Com Responsável"]);

    const ambos = await casoRepository.listar(escritorioId, {
      responsavelIds: [SEM_RESPONSAVEL, membroId],
    });
    expect(ambos.map((c) => c.titulo).sort()).toEqual(["Com Responsável", "Sem Responsável"]);
  });

  it("contar respeita os mesmos filtros de listar", async () => {
    await criar(escritorioId, { titulo: "Um", cliente: clienteId, status: statusId });
    await criar(escritorioId, { titulo: "Dois", cliente: clienteId, status: statusId });

    expect(await casoRepository.contar(escritorioId, { statusIds: [statusId] })).toBe(2);
    expect(await casoRepository.contar(escritorioId, { statusIds: [outroStatusId] })).toBe(0);
  });

  it("update altera os campos do caso", async () => {
    const caso = await criar(escritorioId, { titulo: "Original", cliente: clienteId, status: statusId });
    const atualizado = await casoRepository.update(caso.id, { titulo: "Atualizado" });
    expect(atualizado.titulo).toBe("Atualizado");
  });

  describe("contarPorStatus", () => {
    it("agrupa a contagem de casos por statusId", async () => {
      await criar(escritorioId, { titulo: "Um", cliente: clienteId, status: statusId });
      await criar(escritorioId, { titulo: "Dois", cliente: clienteId, status: statusId });
      await criar(escritorioId, { titulo: "Três", cliente: clienteId, status: outroStatusId });

      const contagens = await casoRepository.contarPorStatus(escritorioId);

      expect(
        contagens
          .map(({ statusId: sid, total }) => ({ statusId: sid, total }))
          .sort((a, b) => a.statusId.localeCompare(b.statusId))
      ).toEqual(
        [
          { statusId: statusId, total: 2 },
          { statusId: outroStatusId, total: 1 },
        ].sort((a, b) => a.statusId.localeCompare(b.statusId))
      );
    });

    it("por padrão ignora casos arquivados", async () => {
      await criar(escritorioId, { titulo: "Ativo", cliente: clienteId, status: statusId });
      await criar(escritorioId, {
        titulo: "Arquivado",
        cliente: clienteId,
        status: statusId,
        arquivado: true,
      });

      const contagens = await casoRepository.contarPorStatus(escritorioId);
      expect(contagens).toEqual([{ statusId, total: 1, valorTotal: 0 }]);
    });

    it("não devolve contagens de outro escritório (RN19)", async () => {
      await criar(escritorioId, { titulo: "Do Tenant", cliente: clienteId, status: statusId });

      const outroCliente = await clienteRepository.create({
        nome: "Cliente Outro Tenant Contagem",
        cpf: "70706433004",
        escritorio: { connect: { id: outroEscritorioId } },
      });
      const outroTipo = await tipoStatusRepository.findByChave("lead");
      const outroStatusOutroTenant = await statusRepository.create({
        nome: "Status Outro Tenant Contagem",
        icone: "MessageCircle",
        cor: "#64748b",
        ordem: 1,
        escritorio: { connect: { id: outroEscritorioId } },
        tipo: { connect: { id: outroTipo!.id } },
      });
      await criar(outroEscritorioId, {
        titulo: "De Outro Tenant",
        cliente: outroCliente.id,
        status: outroStatusOutroTenant.id,
      });

      const contagens = await casoRepository.contarPorStatus(escritorioId);
      expect(contagens).toEqual([{ statusId, total: 1, valorTotal: 0 }]);

      await prisma.caso.deleteMany({ where: { escritorioId: outroEscritorioId } });
      await prisma.status.delete({ where: { id: outroStatusOutroTenant.id } });
      await prisma.cliente.delete({ where: { id: outroCliente.id } });
    });

    it("soma o valor dos casos por statusId", async () => {
      await criar(escritorioId, {
        titulo: "Um",
        cliente: clienteId,
        status: statusId,
        valor: 1000,
      });
      await criar(escritorioId, {
        titulo: "Dois",
        cliente: clienteId,
        status: statusId,
        valor: 500.5,
      });
      await criar(escritorioId, {
        titulo: "Três",
        cliente: clienteId,
        status: outroStatusId,
        valor: 200,
      });

      const contagens = await casoRepository.contarPorStatus(escritorioId);

      const doStatus = contagens.find((c) => c.statusId === statusId);
      const doOutroStatus = contagens.find((c) => c.statusId === outroStatusId);
      expect(doStatus).toEqual({ statusId, total: 2, valorTotal: 1500.5 });
      expect(doOutroStatus).toEqual({ statusId: outroStatusId, total: 1, valorTotal: 200 });
    });

    it("valorTotal é 0 quando não há casos para o status", async () => {
      const contagens = await casoRepository.contarPorStatus(escritorioId);
      expect(contagens).toEqual([]);
    });
  });

});
