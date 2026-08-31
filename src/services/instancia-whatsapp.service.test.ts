import {
  instanciaWhatsappService,
  InstanciaWhatsappNaoEncontradaError,
  NomeInstanciaDuplicadoError,
  PermissaoNegadaError,
} from "./instancia-whatsapp.service";
import { instanciaWhatsappRepository } from "@/repositories/instancia-whatsapp.repository";
import { uazapiClient } from "@/lib/external/uazapi-client";
import { logService } from "@/services/log.service";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { InstanciaWhatsapp } from "@prisma/client";

jest.mock("@/repositories/instancia-whatsapp.repository");
jest.mock("@/lib/external/uazapi-client");
jest.mock("@/services/log.service");
jest.mock("@/lib/prisma", () => ({
  // A transação roda o callback direto: os repositórios já estão mockados.
  prisma: { $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({})) },
}));

const repo = instanciaWhatsappRepository as jest.Mocked<typeof instanciaWhatsappRepository>;
const client = uazapiClient as jest.Mocked<typeof uazapiClient>;
const logs = logService as jest.Mocked<typeof logService>;

function ctx(role: TenantContext["role"] = "owner"): TenantContext {
  return { usuarioId: "user-1", escritorioId: "esc-1", role };
}

function instanciaFake(over: Partial<InstanciaWhatsapp> = {}): InstanciaWhatsapp {
  return {
    id: "instancia-1",
    escritorioId: "esc-1",
    nome: "Atendimento",
    uazapiInstanceId: "uazapi-id-1",
    uazapiToken: "token-secreto",
    status: "connected",
    numeroConectado: "5511999999999",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  logs.registrar.mockResolvedValue({} as never);
});

describe("instanciaWhatsappService.listar", () => {
  it("lista as instâncias do escritório sem expor o uazapiToken", async () => {
    repo.listar.mockResolvedValue([instanciaFake(), instanciaFake({ id: "instancia-2" })]);

    const resultado = await instanciaWhatsappService.listar(ctx());

    expect(repo.listar).toHaveBeenCalledWith("esc-1");
    expect(resultado).toHaveLength(2);
    for (const item of resultado) {
      expect(item).not.toHaveProperty("uazapiToken");
    }
  });
});

describe("instanciaWhatsappService.criarEConectar", () => {
  const dados = { nome: "  Atendimento  " };

  it("rejeita role padrao sem tocar repository ou client", async () => {
    await expect(instanciaWhatsappService.criarEConectar(ctx("padrao"), dados)).rejects.toThrow(
      PermissaoNegadaError
    );
    expect(repo.findByNome).not.toHaveBeenCalled();
    expect(client.criarInstancia).not.toHaveBeenCalled();
  });

  it("rejeita nome duplicado sem chamar a UAZAPI", async () => {
    repo.findByNome.mockResolvedValue(instanciaFake());

    await expect(instanciaWhatsappService.criarEConectar(ctx(), dados)).rejects.toThrow(
      NomeInstanciaDuplicadoError
    );
    expect(client.criarInstancia).not.toHaveBeenCalled();
    expect(client.conectarInstancia).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("cria a instância na UAZAPI, conecta, grava e loga na ordem certa", async () => {
    repo.findByNome.mockResolvedValue(null);
    client.criarInstancia.mockResolvedValue({
      id: "uazapi-id-1",
      token: "token-secreto",
      status: "disconnected",
    });
    client.conectarInstancia.mockResolvedValue({
      status: "connecting",
      qrcode: "data:image/png;base64,abc",
      paircode: "1234-5678",
    });
    repo.create.mockResolvedValue(instanciaFake({ status: "connecting", numeroConectado: null }));

    const chamadas: string[] = [];
    repo.findByNome.mockImplementation(async () => {
      chamadas.push("findByNome");
      return null;
    });
    client.criarInstancia.mockImplementation(async () => {
      chamadas.push("criarInstancia");
      return { id: "uazapi-id-1", token: "token-secreto", status: "disconnected" };
    });
    client.conectarInstancia.mockImplementation(async () => {
      chamadas.push("conectarInstancia");
      return { status: "connecting", qrcode: "data:image/png;base64,abc", paircode: "1234-5678" };
    });
    repo.create.mockImplementation(async () => {
      chamadas.push("create");
      return instanciaFake({ status: "connecting", numeroConectado: null });
    });

    const resultado = await instanciaWhatsappService.criarEConectar(ctx(), dados);

    expect(chamadas).toEqual(["findByNome", "criarInstancia", "conectarInstancia", "create"]);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: "Atendimento",
        uazapiInstanceId: "uazapi-id-1",
        uazapiToken: "token-secreto",
        status: "connecting",
        escritorio: { connect: { id: "esc-1" } },
      }),
      expect.anything()
    );
    expect(logs.registrar).toHaveBeenCalledWith(
      ctx(),
      expect.objectContaining({
        acao: "criar",
        entidade: "instancia_whatsapp",
        resumo: expect.stringContaining("Atendimento"),
      }),
      expect.anything()
    );

    expect(resultado.qrcode).toBe("data:image/png;base64,abc");
    expect(resultado.paircode).toBe("1234-5678");
    expect(resultado.instancia).not.toHaveProperty("uazapiToken");
  });
});

describe("instanciaWhatsappService.reconectar", () => {
  it("rejeita role padrao sem tocar repository ou client", async () => {
    await expect(instanciaWhatsappService.reconectar(ctx("padrao"), "instancia-1")).rejects.toThrow(
      PermissaoNegadaError
    );
    expect(repo.findById).not.toHaveBeenCalled();
    expect(client.conectarInstancia).not.toHaveBeenCalled();
  });

  it("trata instância de outro escritório como inexistente (RN19)", async () => {
    repo.findById.mockResolvedValue(instanciaFake({ escritorioId: "esc-2" }));

    await expect(instanciaWhatsappService.reconectar(ctx(), "instancia-1")).rejects.toThrow(
      InstanciaWhatsappNaoEncontradaError
    );
    expect(client.conectarInstancia).not.toHaveBeenCalled();
  });

  it("rejeita id inexistente", async () => {
    repo.findById.mockResolvedValue(null);
    await expect(instanciaWhatsappService.reconectar(ctx(), "sumida")).rejects.toThrow(
      InstanciaWhatsappNaoEncontradaError
    );
  });

  it("reusa o token já salvo (não recria a instância na UAZAPI), atualiza e loga", async () => {
    repo.findById.mockResolvedValue(instanciaFake({ status: "disconnected" }));
    client.conectarInstancia.mockResolvedValue({
      status: "connecting",
      qrcode: "qrcode-novo",
      paircode: "paircode-novo",
    });
    repo.atualizarConexao.mockResolvedValue(instanciaFake({ status: "connecting" }));

    const resultado = await instanciaWhatsappService.reconectar(ctx(), "instancia-1");

    expect(client.criarInstancia).not.toHaveBeenCalled();
    expect(client.conectarInstancia).toHaveBeenCalledWith("token-secreto");
    expect(repo.atualizarConexao).toHaveBeenCalledWith(
      "instancia-1",
      expect.objectContaining({ status: "connecting" }),
      expect.anything()
    );
    expect(logs.registrar).toHaveBeenCalledWith(
      ctx(),
      expect.objectContaining({
        acao: "atualizar",
        entidade: "instancia_whatsapp",
        resumo: expect.stringContaining("reconectada"),
      }),
      expect.anything()
    );
    expect(resultado.qrcode).toBe("qrcode-novo");
    expect(resultado.paircode).toBe("paircode-novo");
    expect(resultado.instancia).not.toHaveProperty("uazapiToken");
  });
});

describe("instanciaWhatsappService.verificarStatus", () => {
  it("trata instância de outro escritório como inexistente (RN19)", async () => {
    repo.findById.mockResolvedValue(instanciaFake({ escritorioId: "esc-2" }));
    await expect(instanciaWhatsappService.verificarStatus(ctx(), "instancia-1")).rejects.toThrow(
      InstanciaWhatsappNaoEncontradaError
    );
  });

  it("não escreve nem loga quando nada mudou", async () => {
    repo.findById.mockResolvedValue(
      instanciaFake({ status: "connected", numeroConectado: "5511999999999" })
    );
    client.consultarStatus.mockResolvedValue({
      status: "connected",
      numeroConectado: "5511999999999",
    });

    const resultado = await instanciaWhatsappService.verificarStatus(ctx(), "instancia-1");

    expect(repo.atualizarConexao).not.toHaveBeenCalled();
    expect(logs.registrar).not.toHaveBeenCalled();
    expect(resultado.status).toBe("connected");
    expect(resultado).not.toHaveProperty("uazapiToken");
  });

  it("atualiza e loga quando o status mudou", async () => {
    repo.findById.mockResolvedValue(
      instanciaFake({ status: "connecting", numeroConectado: null })
    );
    client.consultarStatus.mockResolvedValue({
      status: "connected",
      numeroConectado: "5511999999999",
    });
    repo.atualizarConexao.mockResolvedValue(
      instanciaFake({ status: "connected", numeroConectado: "5511999999999" })
    );

    const resultado = await instanciaWhatsappService.verificarStatus(ctx(), "instancia-1");

    expect(repo.atualizarConexao).toHaveBeenCalledWith(
      "instancia-1",
      { status: "connected", numeroConectado: "5511999999999" },
      expect.anything()
    );
    expect(logs.registrar).toHaveBeenCalledWith(
      ctx(),
      expect.objectContaining({ acao: "atualizar", entidade: "instancia_whatsapp" }),
      expect.anything()
    );
    expect(resultado.status).toBe("connected");
  });

  it("atualiza quando só o numeroConectado mudou (status igual)", async () => {
    repo.findById.mockResolvedValue(
      instanciaFake({ status: "connected", numeroConectado: "5511999999999" })
    );
    client.consultarStatus.mockResolvedValue({
      status: "connected",
      numeroConectado: "5511888888888",
    });
    repo.atualizarConexao.mockResolvedValue(
      instanciaFake({ status: "connected", numeroConectado: "5511888888888" })
    );

    await instanciaWhatsappService.verificarStatus(ctx(), "instancia-1");

    expect(repo.atualizarConexao).toHaveBeenCalledWith(
      "instancia-1",
      { status: "connected", numeroConectado: "5511888888888" },
      expect.anything()
    );
  });
});
