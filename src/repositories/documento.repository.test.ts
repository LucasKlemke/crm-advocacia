/**
 * @jest-environment node
 */
import { prisma } from "@/lib/prisma";
import { documentoRepository } from "./documento.repository";
import { escritorioRepository } from "./escritorio.repository";
import { usuarioRepository } from "./usuario.repository";
import { membroRepository } from "./membro.repository";

describe("documentoRepository", () => {
  let escritorioId: string;
  let outroEscritorioId: string;
  let membroId: string;

  beforeAll(async () => {
    escritorioId = (await escritorioRepository.create({ nome: "Escritório Documento Repo" })).id;
    outroEscritorioId = (await escritorioRepository.create({ nome: "Outro Documento Repo" })).id;
    const usuario = await usuarioRepository.create({
      nome: "Autor Documento",
      email: `autor-documento-${Date.now()}@teste.com`,
      senhaHash: "hash",
    });
    membroId = (
      await membroRepository.create({
        usuario: { connect: { id: usuario.id } },
        escritorio: { connect: { id: escritorioId } },
      })
    ).id;
  });

  afterEach(async () => {
    await prisma.documento.deleteMany({
      where: { escritorioId: { in: [escritorioId, outroEscritorioId] } },
    });
  });

  afterAll(async () => {
    await prisma.escritorio.deleteMany({ where: { id: { in: [escritorioId, outroEscritorioId] } } });
    await prisma.$disconnect();
  });

  function criar(escritorio: string, escopoId: string, nomeOriginal: string) {
    return documentoRepository.create({
      escopo: "cliente",
      escopoId,
      nomeOriginal,
      tipoArquivo: "pdf",
      tamanhoKb: 100,
      storageKey: `development/${escritorio}/documentos/cliente/${escopoId}/${nomeOriginal}`,
      escritorio: { connect: { id: escritorio } },
      autor: { connect: { id: membroId } },
    });
  }

  it("lista os documentos ativos do escopo", async () => {
    await criar(escritorioId, "cliente-1", "contrato.pdf");

    const documentos = await documentoRepository.listarPorEscopo(escritorioId, "cliente", "cliente-1");
    expect(documentos).toHaveLength(1);
    expect(documentos[0].nomeOriginal).toBe("contrato.pdf");
  });

  it("não mistura documentos de escopos diferentes", async () => {
    await criar(escritorioId, "cliente-1", "do-cliente-1.pdf");
    await criar(escritorioId, "cliente-2", "do-cliente-2.pdf");

    const documentos = await documentoRepository.listarPorEscopo(escritorioId, "cliente", "cliente-1");
    expect(documentos.map((d) => d.nomeOriginal)).toEqual(["do-cliente-1.pdf"]);
  });

  // Mesmo escopoId em tenants distintos não pode vazar de um para o outro (RN19).
  it("não devolve documento de outro escritório", async () => {
    await criar(outroEscritorioId, "cliente-1", "de-outro-tenant.pdf");
    const documentos = await documentoRepository.listarPorEscopo(escritorioId, "cliente", "cliente-1");
    expect(documentos).toHaveLength(0);
  });

  it("omite documentos soft-deletados", async () => {
    const documento = await criar(escritorioId, "cliente-1", "sera-removido.pdf");
    await documentoRepository.marcarExcluido(documento.id, new Date());

    const documentos = await documentoRepository.listarPorEscopo(escritorioId, "cliente", "cliente-1");
    expect(documentos).toHaveLength(0);
  });

  it("contarPorEscopos agrupa por escopoId e ignora soft-deletados", async () => {
    await criar(escritorioId, "cliente-1", "um.pdf");
    await criar(escritorioId, "cliente-1", "dois.pdf");
    await criar(escritorioId, "cliente-2", "tres.pdf");
    const removido = await criar(escritorioId, "cliente-2", "removido.pdf");
    await documentoRepository.marcarExcluido(removido.id, new Date());
    await criar(outroEscritorioId, "cliente-1", "de-outro-tenant.pdf");

    const contagens = await documentoRepository.contarPorEscopos(escritorioId, "cliente", [
      "cliente-1",
      "cliente-2",
      "cliente-3",
    ]);

    expect(contagens).toEqual({ "cliente-1": 2, "cliente-2": 1 });
  });

  it("contarPorEscopos devolve objeto vazio sem ids", async () => {
    await expect(
      documentoRepository.contarPorEscopos(escritorioId, "cliente", [])
    ).resolves.toEqual({});
  });

  it("findById devolve o documento criado", async () => {
    const criado = await criar(escritorioId, "cliente-1", "para-buscar.pdf");
    await expect(documentoRepository.findById(criado.id)).resolves.toMatchObject({
      id: criado.id,
      nomeOriginal: "para-buscar.pdf",
    });
  });

  // Renomear troca só o metadado nomeOriginal; a storageKey não muda de lugar no S3.
  it("atualizarNome troca o nome exibido sem alterar a storageKey", async () => {
    const criado = await criar(escritorioId, "cliente-1", "antigo.pdf");

    const renomeado = await documentoRepository.atualizarNome(criado.id, "novo-nome.pdf");

    expect(renomeado.nomeOriginal).toBe("novo-nome.pdf");
    expect(renomeado.storageKey).toBe(criado.storageKey);
  });

  // O parâmetro `db` existe para compor com prisma.$transaction: se ele não fosse
  // respeitado, documento e log poderiam ser gravados fora da mesma transação.
  it("respeita o cliente da transação recebido", async () => {
    const criado = await prisma.$transaction((tx) =>
      documentoRepository.create(
        {
          escopo: "cliente",
          escopoId: "cliente-tx",
          nomeOriginal: "dentro-da-transacao.pdf",
          tipoArquivo: "pdf",
          tamanhoKb: 50,
          storageKey: "development/tx/documentos/cliente/cliente-tx/dentro-da-transacao.pdf",
          escritorio: { connect: { id: escritorioId } },
          autor: { connect: { id: membroId } },
        },
        tx
      )
    );

    expect(criado.escopoId).toBe("cliente-tx");
  });
});
