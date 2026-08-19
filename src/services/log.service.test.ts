import { logService } from "./log.service";
import { logRepository } from "@/repositories/log.repository";
import type { TenantContext } from "@/lib/auth/tenant-context";

jest.mock("@/repositories/log.repository");

const repo = logRepository as jest.Mocked<typeof logRepository>;

const ctx: TenantContext = {
  usuarioId: "user-1",
  escritorioId: "esc-1",
  role: "owner",
};

describe("logService.registrar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repo.create.mockResolvedValue({ id: "log-1" } as never);
  });

  it("amarra o log ao usuário e ao escritório da sessão", async () => {
    await logService.registrar(ctx, {
      acao: "criar",
      entidade: "cliente",
      entidadeId: "cli-1",
      resumo: "Cliente Maria Silva criado",
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: "criar",
        entidade: "cliente",
        entidadeId: "cli-1",
        resumo: "Cliente Maria Silva criado",
        escritorio: { connect: { id: "esc-1" } },
        usuario: { connect: { id: "user-1" } },
      }),
      undefined
    );
  });

  it("repassa o cliente da transação para o repositório", async () => {
    const db = {} as never;
    await logService.registrar(
      ctx,
      { acao: "excluir", entidade: "cliente", entidadeId: "cli-1", resumo: "Excluído" },
      db
    );

    expect(repo.create).toHaveBeenCalledWith(expect.anything(), db);
  });

  it("grava o diff quando informado", async () => {
    await logService.registrar(ctx, {
      acao: "atualizar",
      entidade: "cliente",
      entidadeId: "cli-1",
      resumo: "Cliente atualizado",
      dados: { telefone: { antes: "1", depois: "2" } },
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ dados: { telefone: { antes: "1", depois: "2" } } }),
      undefined
    );
  });

  it("omite dados quando não há diff", async () => {
    await logService.registrar(ctx, {
      acao: "criar",
      entidade: "cliente",
      entidadeId: "cli-1",
      resumo: "Criado",
      dados: null,
    });

    expect(repo.create.mock.calls[0][0]).not.toHaveProperty("dados");
  });

  // A coluna é varchar(255): um resumo longo não pode derrubar a operação auditada.
  it("trunca o resumo em 255 caracteres", async () => {
    await logService.registrar(ctx, {
      acao: "criar",
      entidade: "cliente",
      entidadeId: "cli-1",
      resumo: "x".repeat(300),
    });

    const { resumo } = repo.create.mock.calls[0][0] as { resumo: string };
    expect(resumo).toHaveLength(255);
  });
});

describe("logService.listarPorEntidade", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("escopa a consulta ao escritório da sessão", async () => {
    repo.listarPorEntidade.mockResolvedValue([]);

    await logService.listarPorEntidade(ctx, "cliente", "cli-1");

    expect(repo.listarPorEntidade).toHaveBeenCalledWith("esc-1", "cliente", "cli-1");
  });
});
