import {
  membroService,
  PermissaoNegadaError,
  MembroNaoEncontradoError,
  UltimoOwnerError,
} from "./membro.service";
import { membroRepository } from "@/repositories/membro.repository";
import { logService } from "@/services/log.service";
import type { TenantContext } from "@/lib/auth/tenant-context";

jest.mock("@/repositories/membro.repository");
jest.mock("@/services/log.service");
jest.mock("@/lib/prisma", () => ({
  prisma: { $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({})) },
}));

const mockedMembroRepo = membroRepository as jest.Mocked<typeof membroRepository>;
const mockedLogService = logService as jest.Mocked<typeof logService>;

function ctx(role: TenantContext["role"], usuarioId = "user-ator"): TenantContext {
  return { usuarioId, escritorioId: "esc-1", role };
}

describe("membroService.listarEscritoriosDoUsuario", () => {
  afterEach(() => jest.clearAllMocks());

  it("mapeia memberships para {escritorio, role}", async () => {
    mockedMembroRepo.listarComEscritorioPorUsuario.mockResolvedValue([
      { escritorio: { id: "esc-1" }, role: "owner" },
      { escritorio: { id: "esc-2" }, role: "padrao" },
    ] as never);

    const resultado = await membroService.listarEscritoriosDoUsuario("user-1");

    expect(resultado).toEqual([
      { escritorio: { id: "esc-1" }, role: "owner" },
      { escritorio: { id: "esc-2" }, role: "padrao" },
    ]);
  });
});

describe("membroService.trocarEscritorioAtivo", () => {
  afterEach(() => jest.clearAllMocks());

  it("retorna o membro quando o usuário é membro do escritório", async () => {
    mockedMembroRepo.findByUsuarioEEscritorio.mockResolvedValue({ id: "membro-1" } as never);

    const resultado = await membroService.trocarEscritorioAtivo("user-1", "esc-1");

    expect(resultado).toEqual({ id: "membro-1" });
  });

  it("rejeita quando o usuário não é membro do escritório (RN19)", async () => {
    mockedMembroRepo.findByUsuarioEEscritorio.mockResolvedValue(null);

    await expect(membroService.trocarEscritorioAtivo("user-1", "esc-1")).rejects.toThrow(
      PermissaoNegadaError
    );
  });
});

describe("membroService.listarMembros", () => {
  afterEach(() => jest.clearAllMocks());

  it("lista membros do escritório do contexto", async () => {
    mockedMembroRepo.listarComUsuarioPorEscritorio.mockResolvedValue([{ id: "membro-1" }] as never);

    const resultado = await membroService.listarMembros(ctx("padrao"));

    expect(mockedMembroRepo.listarComUsuarioPorEscritorio).toHaveBeenCalledWith("esc-1");
    expect(resultado).toEqual([{ id: "membro-1" }]);
  });
});

describe("membroService.alterarRole", () => {
  afterEach(() => jest.clearAllMocks());

  it("rejeita quando o membro alvo não existe no escritório do contexto", async () => {
    mockedMembroRepo.findById.mockResolvedValue(null);

    await expect(
      membroService.alterarRole(ctx("owner"), "membro-1", "admin")
    ).rejects.toThrow(MembroNaoEncontradoError);
  });

  it("rejeita quando o membro alvo é de outro escritório", async () => {
    mockedMembroRepo.findById.mockResolvedValue({
      id: "membro-1",
      escritorioId: "esc-outro",
      usuarioId: "user-alvo",
      role: "padrao",
    } as never);

    await expect(
      membroService.alterarRole(ctx("owner"), "membro-1", "admin")
    ).rejects.toThrow(MembroNaoEncontradoError);
  });

  it("bloqueia auto-alteração de role", async () => {
    mockedMembroRepo.findById.mockResolvedValue({
      id: "membro-1",
      escritorioId: "esc-1",
      usuarioId: "user-ator",
      role: "owner",
    } as never);

    await expect(
      membroService.alterarRole(ctx("owner"), "membro-1", "admin")
    ).rejects.toThrow(PermissaoNegadaError);
  });

  it("admin não pode alterar outro admin (mesmo nível)", async () => {
    mockedMembroRepo.findById.mockResolvedValue({
      id: "membro-1",
      escritorioId: "esc-1",
      usuarioId: "user-alvo",
      role: "admin",
    } as never);

    await expect(
      membroService.alterarRole(ctx("admin"), "membro-1", "padrao")
    ).rejects.toThrow(PermissaoNegadaError);
  });

  it("admin não pode promover ninguém a owner", async () => {
    mockedMembroRepo.findById.mockResolvedValue({
      id: "membro-1",
      escritorioId: "esc-1",
      usuarioId: "user-alvo",
      role: "padrao",
    } as never);

    await expect(
      membroService.alterarRole(ctx("admin"), "membro-1", "owner")
    ).rejects.toThrow(PermissaoNegadaError);
  });

  it("owner pode promover padrao a owner", async () => {
    mockedMembroRepo.findById.mockResolvedValue({
      id: "membro-1",
      escritorioId: "esc-1",
      usuarioId: "user-alvo",
      role: "padrao",
    } as never);
    mockedMembroRepo.contarOwners.mockResolvedValue(1);
    mockedMembroRepo.atualizarRole.mockResolvedValue({ id: "membro-1", role: "owner" } as never);

    const resultado = await membroService.alterarRole(ctx("owner"), "membro-1", "owner");

    expect(resultado.role).toBe("owner");
    expect(mockedLogService.registrar).toHaveBeenCalledWith(
      ctx("owner"),
      expect.objectContaining({ acao: "atualizar", entidade: "membro", entidadeId: "membro-1" }),
      {}
    );
  });

  it("não grava log nem consulta owners quando o papel não muda", async () => {
    mockedMembroRepo.findById.mockResolvedValue({
      id: "membro-1",
      escritorioId: "esc-1",
      usuarioId: "user-alvo",
      role: "admin",
    } as never);

    const resultado = await membroService.alterarRole(ctx("owner"), "membro-1", "admin");

    expect(resultado.role).toBe("admin");
    expect(mockedMembroRepo.contarOwners).not.toHaveBeenCalled();
    expect(mockedMembroRepo.atualizarRole).not.toHaveBeenCalled();
    expect(mockedLogService.registrar).not.toHaveBeenCalled();
  });

  it("bloqueia rebaixar o último owner", async () => {
    mockedMembroRepo.findById.mockResolvedValue({
      id: "membro-1",
      escritorioId: "esc-1",
      usuarioId: "user-alvo",
      role: "owner",
    } as never);
    mockedMembroRepo.contarOwners.mockResolvedValue(1);

    await expect(
      membroService.alterarRole(ctx("owner"), "membro-1", "admin")
    ).rejects.toThrow(UltimoOwnerError);
  });

  it("permite rebaixar um owner quando há outros owners", async () => {
    mockedMembroRepo.findById.mockResolvedValue({
      id: "membro-1",
      escritorioId: "esc-1",
      usuarioId: "user-alvo",
      role: "owner",
    } as never);
    mockedMembroRepo.contarOwners.mockResolvedValue(2);
    mockedMembroRepo.atualizarRole.mockResolvedValue({ id: "membro-1", role: "admin" } as never);

    await expect(
      membroService.alterarRole(ctx("owner"), "membro-1", "admin")
    ).resolves.toEqual({ id: "membro-1", role: "admin" });
  });
});

describe("membroService.remover", () => {
  afterEach(() => jest.clearAllMocks());

  it("rejeita quando o membro alvo não existe no escritório do contexto", async () => {
    mockedMembroRepo.findById.mockResolvedValue(null);

    await expect(membroService.remover(ctx("owner"), "membro-1")).rejects.toThrow(
      MembroNaoEncontradoError
    );
  });

  it("bloqueia auto-remoção", async () => {
    mockedMembroRepo.findById.mockResolvedValue({
      id: "membro-1",
      escritorioId: "esc-1",
      usuarioId: "user-ator",
      role: "padrao",
    } as never);

    await expect(membroService.remover(ctx("owner"), "membro-1")).rejects.toThrow(
      PermissaoNegadaError
    );
  });

  it("padrao não pode remover ninguém", async () => {
    mockedMembroRepo.findById.mockResolvedValue({
      id: "membro-1",
      escritorioId: "esc-1",
      usuarioId: "user-alvo",
      role: "padrao",
    } as never);

    await expect(membroService.remover(ctx("padrao"), "membro-1")).rejects.toThrow(
      PermissaoNegadaError
    );
  });

  it("bloqueia remover o último owner", async () => {
    mockedMembroRepo.findById.mockResolvedValue({
      id: "membro-1",
      escritorioId: "esc-1",
      usuarioId: "user-alvo",
      role: "owner",
    } as never);
    mockedMembroRepo.contarOwners.mockResolvedValue(1);

    await expect(membroService.remover(ctx("owner"), "membro-1")).rejects.toThrow(
      UltimoOwnerError
    );
  });

  it("remove um membro quando permitido", async () => {
    mockedMembroRepo.findById.mockResolvedValue({
      id: "membro-1",
      escritorioId: "esc-1",
      usuarioId: "user-alvo",
      role: "padrao",
    } as never);
    mockedMembroRepo.contarOwners.mockResolvedValue(1);

    await membroService.remover(ctx("owner"), "membro-1");

    expect(mockedMembroRepo.remover).toHaveBeenCalledWith("membro-1", {});
    expect(mockedLogService.registrar).toHaveBeenCalledWith(
      ctx("owner"),
      expect.objectContaining({ acao: "excluir", entidade: "membro", entidadeId: "membro-1" }),
      {}
    );
  });
});
