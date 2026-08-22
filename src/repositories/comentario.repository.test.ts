/**
 * @jest-environment node
 */
import { prisma } from "@/lib/prisma";
import { comentarioRepository } from "./comentario.repository";
import { escritorioRepository } from "./escritorio.repository";
import { usuarioRepository } from "./usuario.repository";

describe("comentarioRepository", () => {
  let escritorioId: string;
  let outroEscritorioId: string;
  let autorId: string;

  beforeAll(async () => {
    escritorioId = (await escritorioRepository.create({ nome: "Escritório Comentário Repo" })).id;
    outroEscritorioId = (await escritorioRepository.create({ nome: "Outro Comentário Repo" })).id;
    autorId = (
      await usuarioRepository.create({
        nome: "Autora",
        email: `autora-comentario-${Date.now()}@teste.com`,
        senhaHash: "hash",
      })
    ).id;
  });

  afterEach(async () => {
    await prisma.comentario.deleteMany({
      where: { escritorioId: { in: [escritorioId, outroEscritorioId] } },
    });
  });

  afterAll(async () => {
    await prisma.escritorio.deleteMany({
      where: { id: { in: [escritorioId, outroEscritorioId] } },
    });
    await prisma.usuario.delete({ where: { id: autorId } });
    await prisma.$disconnect();
  });

  function criar(escritorio: string, escopoId: string, conteudo: string) {
    return comentarioRepository.create({
      escopo: "cliente",
      escopoId,
      conteudo,
      escritorio: { connect: { id: escritorio } },
      autor: { connect: { id: autorId } },
    });
  }

  it("lista os comentários do escopo com o autor embutido", async () => {
    await criar(escritorioId, "cliente-1", "Primeiro contato feito.");

    const comentarios = await comentarioRepository.listarPorEscopo(
      escritorioId,
      "cliente",
      "cliente-1"
    );
    expect(comentarios).toHaveLength(1);
    expect(comentarios[0].autor.nome).toBe("Autora");
  });

  it("não expõe senhaHash do autor e inclui avatarUrl", async () => {
    await criar(escritorioId, "cliente-avatar", "Comentário com autor.");

    const comentarios = await comentarioRepository.listarPorEscopo(
      escritorioId,
      "cliente",
      "cliente-avatar"
    );

    expect(comentarios[0].autor).not.toHaveProperty("senhaHash");
    expect(Object.keys(comentarios[0].autor).sort()).toEqual(["avatarUrl", "email", "id", "nome"]);
  });

  it("contarPorEscopos agrupa por escopoId e ignora soft-deletados", async () => {
    await criar(escritorioId, "cliente-1", "Um");
    await criar(escritorioId, "cliente-1", "Dois");
    await criar(escritorioId, "cliente-2", "Três");
    const removido = await criar(escritorioId, "cliente-2", "Removido");
    await comentarioRepository.marcarExcluido(removido.id, new Date());
    await criar(outroEscritorioId, "cliente-1", "De outro tenant");

    const contagens = await comentarioRepository.contarPorEscopos(escritorioId, "cliente", [
      "cliente-1",
      "cliente-2",
      "cliente-3",
    ]);

    expect(contagens).toEqual({ "cliente-1": 2, "cliente-2": 1 });
  });

  it("contarPorEscopos devolve objeto vazio sem ids", async () => {
    await expect(
      comentarioRepository.contarPorEscopos(escritorioId, "cliente", [])
    ).resolves.toEqual({});
  });

  it("não mistura comentários de escopos diferentes", async () => {
    await criar(escritorioId, "cliente-1", "Do cliente 1");
    await criar(escritorioId, "cliente-2", "Do cliente 2");

    const comentarios = await comentarioRepository.listarPorEscopo(
      escritorioId,
      "cliente",
      "cliente-1"
    );
    expect(comentarios.map((c) => c.conteudo)).toEqual(["Do cliente 1"]);
  });

  // Mesmo escopoId em tenants distintos não pode vazar de um para o outro (RN19).
  it("não devolve comentário de outro escritório", async () => {
    await criar(outroEscritorioId, "cliente-1", "De outro tenant");
    const comentarios = await comentarioRepository.listarPorEscopo(
      escritorioId,
      "cliente",
      "cliente-1"
    );
    expect(comentarios).toHaveLength(0);
  });

  it("omite comentários soft-deletados", async () => {
    const comentario = await criar(escritorioId, "cliente-1", "Será removido");
    await comentarioRepository.marcarExcluido(comentario.id, new Date());

    const comentarios = await comentarioRepository.listarPorEscopo(
      escritorioId,
      "cliente",
      "cliente-1"
    );
    expect(comentarios).toHaveLength(0);
  });

  it("ordena do mais recente para o mais antigo", async () => {
    await criar(escritorioId, "cliente-1", "Antigo");
    await new Promise((resolve) => setTimeout(resolve, 5));
    await criar(escritorioId, "cliente-1", "Recente");

    const comentarios = await comentarioRepository.listarPorEscopo(
      escritorioId,
      "cliente",
      "cliente-1"
    );
    expect(comentarios.map((c) => c.conteudo)).toEqual(["Recente", "Antigo"]);
  });

  describe("comentarioRepository — leitura e edição pontual", () => {
    it("findById devolve o comentário criado", async () => {
      const criado = await criar(escritorioId, "cliente-1", "Para buscar por id");
      await expect(comentarioRepository.findById(criado.id)).resolves.toMatchObject({
        id: criado.id,
        conteudo: "Para buscar por id",
      });
    });

    it("update grava o novo conteúdo e a marca de edição", async () => {
      const criado = await criar(escritorioId, "cliente-1", "Texto original");
      const editadoEm = new Date();

      const atualizado = await comentarioRepository.update(criado.id, {
        conteudo: "Texto revisado",
        editadoEm,
      });

      expect(atualizado.conteudo).toBe("Texto revisado");
      expect(atualizado.editadoEm?.getTime()).toBe(editadoEm.getTime());
    });

    // O parâmetro `db` existe para compor com prisma.$transaction: se ele não fosse
    // respeitado, comentário e log poderiam ser gravados fora da mesma transação.
    it("respeita o cliente da transação recebido", async () => {
      const criado = await prisma.$transaction((tx) =>
        comentarioRepository.create(
          {
            escopo: "cliente",
            escopoId: "cliente-tx",
            conteudo: "Dentro da transação",
            escritorio: { connect: { id: escritorioId } },
            autor: { connect: { id: autorId } },
          },
          tx
        )
      );

      expect(criado.escopoId).toBe("cliente-tx");
    });
  });
});
