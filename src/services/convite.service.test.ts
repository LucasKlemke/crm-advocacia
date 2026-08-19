import {
  conviteService,
  ConviteJaExisteError,
  JaEhMembroError,
  ConviteNaoEncontradoError,
  PermissaoNegadaError,
} from "./convite.service";
import { conviteRepository } from "@/repositories/convite.repository";
import { membroRepository } from "@/repositories/membro.repository";
import { usuarioRepository } from "@/repositories/usuario.repository";
import type { TenantContext } from "@/lib/auth/tenant-context";

jest.mock("@/repositories/convite.repository");
jest.mock("@/repositories/membro.repository");
jest.mock("@/repositories/usuario.repository");

const mockedConviteRepo = conviteRepository as jest.Mocked<typeof conviteRepository>;
const mockedMembroRepo = membroRepository as jest.Mocked<typeof membroRepository>;
const mockedUsuarioRepo = usuarioRepository as jest.Mocked<typeof usuarioRepository>;

function ctx(role: TenantContext["role"]): TenantContext {
  return { usuarioId: "user-ator", escritorioId: "esc-1", role };
}

describe("conviteService.convidar", () => {
  afterEach(() => jest.clearAllMocks());

  it("bloqueia convite feito por padrao", async () => {
    await expect(
      conviteService.convidar(ctx("padrao"), { email: "novo@teste.com", role: "padrao" })
    ).rejects.toThrow(PermissaoNegadaError);
    expect(mockedUsuarioRepo.findByEmail).not.toHaveBeenCalled();
  });

  it("bloqueia admin convidando como owner", async () => {
    await expect(
      conviteService.convidar(ctx("admin"), { email: "novo@teste.com", role: "owner" })
    ).rejects.toThrow(PermissaoNegadaError);
  });

  it("cria membership direto quando o e-mail já é um usuário cadastrado", async () => {
    mockedUsuarioRepo.findByEmail.mockResolvedValue({ id: "user-existente" } as never);
    mockedMembroRepo.findByUsuarioEEscritorio.mockResolvedValue(null);
    mockedMembroRepo.create.mockResolvedValue({ id: "membro-1", role: "padrao" } as never);

    const resultado = await conviteService.convidar(ctx("owner"), {
      email: "existente@teste.com",
      role: "padrao",
    });

    expect(resultado).toEqual({ tipo: "membro", membro: { id: "membro-1", role: "padrao" } });
    expect(mockedConviteRepo.create).not.toHaveBeenCalled();
  });

  it("rejeita quando o e-mail já é membro do escritório", async () => {
    mockedUsuarioRepo.findByEmail.mockResolvedValue({ id: "user-existente" } as never);
    mockedMembroRepo.findByUsuarioEEscritorio.mockResolvedValue({ id: "membro-1" } as never);

    await expect(
      conviteService.convidar(ctx("owner"), { email: "existente@teste.com", role: "padrao" })
    ).rejects.toThrow(JaEhMembroError);
  });

  it("cria convite pendente quando o e-mail não é um usuário cadastrado", async () => {
    mockedUsuarioRepo.findByEmail.mockResolvedValue(null);
    mockedConviteRepo.findByEscritorioEEmail.mockResolvedValue(null);
    mockedConviteRepo.create.mockResolvedValue({ id: "convite-1" } as never);

    const resultado = await conviteService.convidar(ctx("owner"), {
      email: "novo@teste.com",
      role: "padrao",
    });

    expect(resultado).toEqual({ tipo: "convite", convite: { id: "convite-1" } });
  });

  it("rejeita convite duplicado para o mesmo e-mail no escritório", async () => {
    mockedUsuarioRepo.findByEmail.mockResolvedValue(null);
    mockedConviteRepo.findByEscritorioEEmail.mockResolvedValue({ id: "convite-existente" } as never);

    await expect(
      conviteService.convidar(ctx("owner"), { email: "novo@teste.com", role: "padrao" })
    ).rejects.toThrow(ConviteJaExisteError);
  });
});

describe("conviteService.listarPendentes", () => {
  afterEach(() => jest.clearAllMocks());

  it("bloqueia listagem por padrao", async () => {
    await expect(conviteService.listarPendentes(ctx("padrao"))).rejects.toThrow(
      PermissaoNegadaError
    );
  });

  it("lista convites pendentes do escritório para owner/admin", async () => {
    mockedConviteRepo.listarPorEscritorio.mockResolvedValue([{ id: "convite-1" }] as never);

    const resultado = await conviteService.listarPendentes(ctx("admin"));

    expect(resultado).toEqual([{ id: "convite-1" }]);
  });
});

describe("conviteService.cancelar", () => {
  afterEach(() => jest.clearAllMocks());

  it("rejeita quando o convite não existe", async () => {
    mockedConviteRepo.findById.mockResolvedValue(null);

    await expect(conviteService.cancelar(ctx("owner"), "convite-1")).rejects.toThrow(
      ConviteNaoEncontradoError
    );
  });

  it("rejeita quando o convite é de outro escritório", async () => {
    mockedConviteRepo.findById.mockResolvedValue({ id: "convite-1", escritorioId: "esc-outro" } as never);

    await expect(conviteService.cancelar(ctx("owner"), "convite-1")).rejects.toThrow(
      ConviteNaoEncontradoError
    );
  });

  it("bloqueia cancelamento por padrao", async () => {
    mockedConviteRepo.findById.mockResolvedValue({ id: "convite-1", escritorioId: "esc-1" } as never);

    await expect(conviteService.cancelar(ctx("padrao"), "convite-1")).rejects.toThrow(
      PermissaoNegadaError
    );
    expect(mockedConviteRepo.remover).not.toHaveBeenCalled();
  });

  it("cancela o convite quando permitido", async () => {
    mockedConviteRepo.findById.mockResolvedValue({ id: "convite-1", escritorioId: "esc-1" } as never);

    await conviteService.cancelar(ctx("admin"), "convite-1");

    expect(mockedConviteRepo.remover).toHaveBeenCalledWith("convite-1");
  });
});
