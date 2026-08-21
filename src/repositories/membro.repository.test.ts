/**
 * @jest-environment node
 */
import { prisma } from "@/lib/prisma";
import { membroRepository } from "./membro.repository";
import { escritorioRepository } from "./escritorio.repository";
import { usuarioRepository } from "./usuario.repository";

describe("membroRepository", () => {
  let escritorioId: string;
  let escritorio2Id: string;
  let usuarioId: string;
  const membrosCriados: string[] = [];

  beforeAll(async () => {
    const escritorio = await escritorioRepository.create({ nome: "Escritório Membro Repo" });
    escritorioId = escritorio.id;
    const escritorio2 = await escritorioRepository.create({ nome: "Escritório Membro Repo 2" });
    escritorio2Id = escritorio2.id;
    const usuario = await usuarioRepository.create({
      nome: "Usuário Membro Repo",
      email: `membro-repo-${Date.now()}@teste.com`,
      senhaHash: "hash",
    });
    usuarioId = usuario.id;
  });

  afterEach(async () => {
    if (membrosCriados.length) {
      await prisma.membro.deleteMany({ where: { id: { in: membrosCriados } } });
      membrosCriados.length = 0;
    }
  });

  afterAll(async () => {
    await prisma.escritorio.deleteMany({ where: { id: { in: [escritorioId, escritorio2Id] } } });
    await prisma.usuario.delete({ where: { id: usuarioId } });
    await prisma.$disconnect();
  });

  it("cria um membro com role padrão por default", async () => {
    const membro = await membroRepository.create({
      usuario: { connect: { id: usuarioId } },
      escritorio: { connect: { id: escritorioId } },
    });
    membrosCriados.push(membro.id);

    expect(membro.role).toBe("padrao");
  });

  it("busca por id", async () => {
    const criado = await membroRepository.create({
      usuario: { connect: { id: usuarioId } },
      escritorio: { connect: { id: escritorioId } },
    });
    membrosCriados.push(criado.id);

    const encontrado = await membroRepository.findById(criado.id);

    expect(encontrado?.id).toBe(criado.id);
  });

  it("retorna null ao buscar id inexistente", async () => {
    const encontrado = await membroRepository.findById("00000000-0000-0000-0000-000000000000");
    expect(encontrado).toBeNull();
  });

  it("busca membership por usuário e escritório", async () => {
    const criado = await membroRepository.create({
      usuario: { connect: { id: usuarioId } },
      escritorio: { connect: { id: escritorioId } },
      role: "owner",
    });
    membrosCriados.push(criado.id);

    const encontrado = await membroRepository.findByUsuarioEEscritorio(usuarioId, escritorioId);

    expect(encontrado?.role).toBe("owner");
  });

  it("retorna null quando não há membership entre usuário e escritório", async () => {
    const encontrado = await membroRepository.findByUsuarioEEscritorio(usuarioId, escritorio2Id);
    expect(encontrado).toBeNull();
  });

  it("lista memberships de um usuário ordenadas da mais antiga para a mais nova", async () => {
    const primeiro = await membroRepository.create({
      usuario: { connect: { id: usuarioId } },
      escritorio: { connect: { id: escritorioId } },
    });
    membrosCriados.push(primeiro.id);
    const segundo = await membroRepository.create({
      usuario: { connect: { id: usuarioId } },
      escritorio: { connect: { id: escritorio2Id } },
    });
    membrosCriados.push(segundo.id);

    const lista = await membroRepository.listarPorUsuario(usuarioId);

    expect(lista.map((m) => m.id)).toEqual([primeiro.id, segundo.id]);
  });

  it("lista memberships de um usuário com dados do escritório", async () => {
    const criado = await membroRepository.create({
      usuario: { connect: { id: usuarioId } },
      escritorio: { connect: { id: escritorioId } },
    });
    membrosCriados.push(criado.id);

    const lista = await membroRepository.listarComEscritorioPorUsuario(usuarioId);

    expect(lista[0].escritorio.id).toBe(escritorioId);
  });

  it("lista membros de um escritório com dados do usuário", async () => {
    const criado = await membroRepository.create({
      usuario: { connect: { id: usuarioId } },
      escritorio: { connect: { id: escritorioId } },
    });
    membrosCriados.push(criado.id);

    const lista = await membroRepository.listarComUsuarioPorEscritorio(escritorioId);

    expect(lista[0].usuario.id).toBe(usuarioId);
  });

  it("não expõe senhaHash (nem outros campos sensíveis) do usuário na listagem", async () => {
    const criado = await membroRepository.create({
      usuario: { connect: { id: usuarioId } },
      escritorio: { connect: { id: escritorioId } },
    });
    membrosCriados.push(criado.id);

    const lista = await membroRepository.listarComUsuarioPorEscritorio(escritorioId);

    expect(lista[0].usuario).not.toHaveProperty("senhaHash");
    expect(Object.keys(lista[0].usuario).sort()).toEqual([
      "avatarUrl",
      "email",
      "id",
      "nome",
      "telefone",
    ]);
    expect(JSON.stringify(lista)).not.toContain("senhaHash");
  });

  it("conta owners de um escritório", async () => {
    const criado = await membroRepository.create({
      usuario: { connect: { id: usuarioId } },
      escritorio: { connect: { id: escritorioId } },
      role: "owner",
    });
    membrosCriados.push(criado.id);

    const total = await membroRepository.contarOwners(escritorioId);

    expect(total).toBe(1);
  });

  it("atualiza o role de um membro", async () => {
    const criado = await membroRepository.create({
      usuario: { connect: { id: usuarioId } },
      escritorio: { connect: { id: escritorioId } },
      role: "padrao",
    });
    membrosCriados.push(criado.id);

    const atualizado = await membroRepository.atualizarRole(criado.id, "admin");

    expect(atualizado.role).toBe("admin");
  });

  it("remove um membro", async () => {
    const criado = await membroRepository.create({
      usuario: { connect: { id: usuarioId } },
      escritorio: { connect: { id: escritorioId } },
    });

    await membroRepository.remover(criado.id);

    const encontrado = await membroRepository.findById(criado.id);
    expect(encontrado).toBeNull();
  });
});
