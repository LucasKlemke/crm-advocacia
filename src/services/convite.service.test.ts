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
    const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000);
    mockedConviteRepo.findByEscritorioEEmail.mockResolvedValue({
      id: "convite-existente",
      expiraEm: amanha,
    } as never);

    await expect(
      conviteService.convidar(ctx("owner"), { email: "novo@teste.com", role: "padrao" })
    ).rejects.toThrow(ConviteJaExisteError);
  });

  it("descarta convite expirado e cria um novo no lugar", async () => {
    mockedUsuarioRepo.findByEmail.mockResolvedValue(null);
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
    mockedConviteRepo.findByEscritorioEEmail.mockResolvedValue({
      id: "convite-expirado",
      expiraEm: ontem,
    } as never);
    mockedConviteRepo.create.mockResolvedValue({ id: "convite-novo" } as never);

    const resultado = await conviteService.convidar(ctx("owner"), {
      email: "novo@teste.com",
      role: "padrao",
    });

    expect(mockedConviteRepo.remover).toHaveBeenCalledWith("convite-expirado");
    expect(resultado).toEqual({ tipo: "convite", convite: { id: "convite-novo" } });
  });
});

describe("conviteService.listarPendentes", () => {
  afterEach(() => jest.clearAllMocks());

  it("bloqueia listagem por padrao", async () => {
    await expect(conviteService.listarPendentes(ctx("padrao"))).rejects.toThrow(
      PermissaoNegadaError
    );
  });

  it("lista convites dentro do prazo como pendentes para owner/admin", async () => {
    const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000);
    mockedConviteRepo.listarPendentesPorEscritorio.mockResolvedValue([
      { id: "convite-1", expiraEm: amanha },
    ] as never);

    const resultado = await conviteService.listarPendentes(ctx("admin"));

    expect(resultado).toEqual([{ id: "convite-1", expiraEm: amanha }]);
    expect(mockedConviteRepo.listarPorEscritorio).not.toHaveBeenCalled();
  });

  it("consulta o repositório filtrando por expiração (convite vencido não é pendente)", async () => {
    mockedConviteRepo.listarPendentesPorEscritorio.mockResolvedValue([] as never);

    const antes = Date.now();
    const resultado = await conviteService.listarPendentes(ctx("owner"));
    const depois = Date.now();

    expect(resultado).toEqual([]);
    expect(mockedConviteRepo.listarPendentesPorEscritorio).toHaveBeenCalledTimes(1);
    const [escritorioId, agora] = mockedConviteRepo.listarPendentesPorEscritorio.mock.calls[0];
    expect(escritorioId).toBe("esc-1");
    expect(agora).toBeInstanceOf(Date);
    expect((agora as Date).getTime()).toBeGreaterThanOrEqual(antes);
    expect((agora as Date).getTime()).toBeLessThanOrEqual(depois);
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
