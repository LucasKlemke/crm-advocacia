import {
  instanciaWhatsappService,
  InstanciaWhatsappNaoEncontradaError,
  NomeInstanciaDuplicadoError,
  PermissaoNegadaError,
} from "./instancia-whatsapp.service";
import { instanciaWhatsappRepository } from "@/repositories/instancia-whatsapp.repository";
import { uazapiClient, UazapiIndisponivelError } from "@/lib/external/uazapi-client";
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
    softDeletedAt: null,
    numeroConectado: "5511999999999",
    fotoPerfilUrl: "https://pps.whatsapp.net/foto.jpg",
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

    // Nome enviado à UAZAPI (conta compartilhada por todos os escritórios) é namespaced
    // por tenant — o nome local salvo/exibido continua sem o prefixo (ver expect.objectContaining abaixo).
    expect(client.criarInstancia).toHaveBeenCalledWith("esc-1:Atendimento", {
      adminField01: "esc-1",
    });

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

  // Regressão: um status fora do enum vindo da UAZAPI não pode chegar ao Prisma
  // (PrismaClientValidationError ecoaria o uazapiToken no log do catch da rota).
  it("lança UazapiIndisponivelError se a UAZAPI devolver status fora do enum, sem gravar nem logar", async () => {
    repo.findByNome.mockResolvedValue(null);
    client.criarInstancia.mockResolvedValue({
      id: "uazapi-id-1",
      token: "token-secreto",
      status: "disconnected",
    });
    client.conectarInstancia.mockResolvedValue({ status: "loading" });

    await expect(instanciaWhatsappService.criarEConectar(ctx(), dados)).rejects.toBeInstanceOf(
      UazapiIndisponivelError
    );
    expect(repo.create).not.toHaveBeenCalled();
    expect(logs.registrar).not.toHaveBeenCalled();
  });

  // O usuário confirmou (payloads reais de webhook) que /instance/connect também devolve
  // owner/profilePicUrl quando já disponíveis — precisam ser passados adiante pro repository.
  it("passa numeroConectado/fotoPerfilUrl adiante quando a UAZAPI já os devolve em /instance/connect", async () => {
    repo.findByNome.mockResolvedValue(null);
    client.criarInstancia.mockResolvedValue({
      id: "uazapi-id-1",
      token: "token-secreto",
      status: "disconnected",
    });
    client.conectarInstancia.mockResolvedValue({
      status: "connected",
      numeroConectado: "554796589979",
      fotoPerfilUrl: "https://pps.whatsapp.net/foto.jpg",
    });
    repo.create.mockResolvedValue(
      instanciaFake({
        status: "connected",
        numeroConectado: "554796589979",
        fotoPerfilUrl: "https://pps.whatsapp.net/foto.jpg",
      })
    );

    const resultado = await instanciaWhatsappService.criarEConectar(ctx(), dados);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        numeroConectado: "554796589979",
        fotoPerfilUrl: "https://pps.whatsapp.net/foto.jpg",
      }),
      expect.anything()
    );
    expect(resultado.instancia.fotoPerfilUrl).toBe("https://pps.whatsapp.net/foto.jpg");
  });

  // A conta UAZAPI é compartilhada por todos os escritórios. Sem compensar, o token da
  // instância recém-criada é descartado e ela fica lá para sempre: deletarInstancia exige
  // esse token, e sincronizarTodas só enxerga o que existe no banco.
  it("apaga a instância recém-criada na UAZAPI quando a conexão falha depois da criação", async () => {
    repo.findByNome.mockResolvedValue(null);
    client.criarInstancia.mockResolvedValue({
      id: "uazapi-id-1",
      token: "token-orfao",
      status: "disconnected",
    });
    client.conectarInstancia.mockRejectedValue(new UazapiIndisponivelError());
    client.deletarInstancia.mockResolvedValue(undefined);

    await expect(instanciaWhatsappService.criarEConectar(ctx(), dados)).rejects.toBeInstanceOf(
      UazapiIndisponivelError
    );
    expect(client.deletarInstancia).toHaveBeenCalledWith("token-orfao");
    expect(repo.create).not.toHaveBeenCalled();
    expect(logs.registrar).not.toHaveBeenCalled();
  });

  it("apaga a instância recém-criada quando o status vem fora do enum", async () => {
    repo.findByNome.mockResolvedValue(null);
    client.criarInstancia.mockResolvedValue({
      id: "uazapi-id-1",
      token: "token-orfao",
      status: "disconnected",
    });
    client.conectarInstancia.mockResolvedValue({ status: "loading" });
    client.deletarInstancia.mockResolvedValue(undefined);

    await expect(instanciaWhatsappService.criarEConectar(ctx(), dados)).rejects.toBeInstanceOf(
      UazapiIndisponivelError
    );
    expect(client.deletarInstancia).toHaveBeenCalledWith("token-orfao");
  });

  // A limpeza é best-effort: se ela também falhar, quem precisa chegar ao usuário é a
  // causa original, não o erro da compensação.
  it("propaga o erro original mesmo se a limpeza na UAZAPI também falhar", async () => {
    repo.findByNome.mockResolvedValue(null);
    client.criarInstancia.mockResolvedValue({
      id: "uazapi-id-1",
      token: "token-orfao",
      status: "disconnected",
    });
    const original = new UazapiIndisponivelError("Falha original.");
    client.conectarInstancia.mockRejectedValue(original);
    client.deletarInstancia.mockRejectedValue(new Error("limpeza falhou"));

    await expect(instanciaWhatsappService.criarEConectar(ctx(), dados)).rejects.toBe(original);
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

  it("lança UazapiIndisponivelError se a UAZAPI devolver status fora do enum, sem gravar nem logar", async () => {
    repo.findById.mockResolvedValue(instanciaFake({ status: "disconnected" }));
    client.conectarInstancia.mockResolvedValue({ status: "loading" });

    await expect(instanciaWhatsappService.reconectar(ctx(), "instancia-1")).rejects.toBeInstanceOf(
      UazapiIndisponivelError
    );
    expect(repo.atualizarConexao).not.toHaveBeenCalled();
    expect(logs.registrar).not.toHaveBeenCalled();
  });

  it("passa numeroConectado/fotoPerfilUrl adiante quando a UAZAPI já os devolve em /instance/connect", async () => {
    repo.findById.mockResolvedValue(instanciaFake({ status: "disconnected" }));
    client.conectarInstancia.mockResolvedValue({
      status: "connected",
      numeroConectado: "554796589979",
      fotoPerfilUrl: "https://pps.whatsapp.net/foto.jpg",
    });
    repo.atualizarConexao.mockResolvedValue(
      instanciaFake({
        status: "connected",
        numeroConectado: "554796589979",
        fotoPerfilUrl: "https://pps.whatsapp.net/foto.jpg",
      })
    );

    const resultado = await instanciaWhatsappService.reconectar(ctx(), "instancia-1");

    expect(repo.atualizarConexao).toHaveBeenCalledWith(
      "instancia-1",
      expect.objectContaining({
        status: "connected",
        numeroConectado: "554796589979",
        fotoPerfilUrl: "https://pps.whatsapp.net/foto.jpg",
      }),
      expect.anything()
    );
    expect(resultado.instancia.fotoPerfilUrl).toBe("https://pps.whatsapp.net/foto.jpg");
  });
});

describe("instanciaWhatsappService.verificarStatus", () => {
  it("trata instância de outro escritório como inexistente (RN19)", async () => {
    repo.findById.mockResolvedValue(instanciaFake({ escritorioId: "esc-2" }));
    await expect(instanciaWhatsappService.verificarStatus(ctx(), "instancia-1")).rejects.toThrow(
      InstanciaWhatsappNaoEncontradaError
    );
  });

  it("não escreve nem loga quando nada mudou (status, numeroConectado e fotoPerfilUrl iguais)", async () => {
    repo.findById.mockResolvedValue(
      instanciaFake({
        status: "connected",
        numeroConectado: "5511999999999",
        fotoPerfilUrl: "https://pps.whatsapp.net/foto.jpg",
      })
    );
    client.consultarStatus.mockResolvedValue({
      status: "connected",
      numeroConectado: "5511999999999",
      fotoPerfilUrl: "https://pps.whatsapp.net/foto.jpg",
    });

    const resultado = await instanciaWhatsappService.verificarStatus(ctx(), "instancia-1");

    expect(repo.atualizarConexao).not.toHaveBeenCalled();
    expect(logs.registrar).not.toHaveBeenCalled();
    expect(resultado.status).toBe("connected");
    expect(resultado).not.toHaveProperty("uazapiToken");
  });

  it("atualiza e loga quando o status mudou", async () => {
    repo.findById.mockResolvedValue(
      instanciaFake({ status: "connecting", numeroConectado: null, fotoPerfilUrl: null })
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
      { status: "connected", numeroConectado: "5511999999999", fotoPerfilUrl: null },
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
      instanciaFake({
        status: "connected",
        numeroConectado: "5511999999999",
        fotoPerfilUrl: "https://pps.whatsapp.net/foto.jpg",
      })
    );
    client.consultarStatus.mockResolvedValue({
      status: "connected",
      numeroConectado: "5511888888888",
      fotoPerfilUrl: "https://pps.whatsapp.net/foto.jpg",
    });
    repo.atualizarConexao.mockResolvedValue(
      instanciaFake({ status: "connected", numeroConectado: "5511888888888" })
    );

    await instanciaWhatsappService.verificarStatus(ctx(), "instancia-1");

    expect(repo.atualizarConexao).toHaveBeenCalledWith(
      "instancia-1",
      {
        status: "connected",
        numeroConectado: "5511888888888",
        fotoPerfilUrl: "https://pps.whatsapp.net/foto.jpg",
      },
      expect.anything()
    );
  });

  it("atualiza quando só o fotoPerfilUrl mudou (status e numeroConectado iguais)", async () => {
    repo.findById.mockResolvedValue(
      instanciaFake({
        status: "connected",
        numeroConectado: "5511999999999",
        fotoPerfilUrl: "https://pps.whatsapp.net/foto-antiga.jpg",
      })
    );
    client.consultarStatus.mockResolvedValue({
      status: "connected",
      numeroConectado: "5511999999999",
      fotoPerfilUrl: "https://pps.whatsapp.net/foto-nova.jpg",
    });
    repo.atualizarConexao.mockResolvedValue(
      instanciaFake({ fotoPerfilUrl: "https://pps.whatsapp.net/foto-nova.jpg" })
    );

    const resultado = await instanciaWhatsappService.verificarStatus(ctx(), "instancia-1");

    expect(repo.atualizarConexao).toHaveBeenCalledWith(
      "instancia-1",
      {
        status: "connected",
        numeroConectado: "5511999999999",
        fotoPerfilUrl: "https://pps.whatsapp.net/foto-nova.jpg",
      },
      expect.anything()
    );
    expect(logs.registrar).toHaveBeenCalled();
    expect(resultado.fotoPerfilUrl).toBe("https://pps.whatsapp.net/foto-nova.jpg");
  });

  it("lança UazapiIndisponivelError se a UAZAPI devolver status fora do enum, sem gravar nem logar", async () => {
    repo.findById.mockResolvedValue(
      instanciaFake({ status: "connected", numeroConectado: "5511999999999" })
    );
    client.consultarStatus.mockResolvedValue({ status: "loading" });

    await expect(instanciaWhatsappService.verificarStatus(ctx(), "instancia-1")).rejects.toBeInstanceOf(
      UazapiIndisponivelError
    );
    expect(repo.atualizarConexao).not.toHaveBeenCalled();
    expect(logs.registrar).not.toHaveBeenCalled();
  });
});

describe("instanciaWhatsappService.sincronizarTodas", () => {
  it("retorna [] sem chamar a UAZAPI quando o escritório não tem instâncias locais", async () => {
    repo.listar.mockResolvedValue([]);

    const resultado = await instanciaWhatsappService.sincronizarTodas(ctx());

    expect(resultado).toEqual([]);
    expect(repo.listar).toHaveBeenCalledTimes(1);
    expect(client.listarTodasInstancias).not.toHaveBeenCalled();
  });

  it("não exige papel de gestão — role padrao também pode sincronizar", async () => {
    repo.listar.mockResolvedValue([]);

    await expect(instanciaWhatsappService.sincronizarTodas(ctx("padrao"))).resolves.toEqual([]);
  });

  it("nunca cria/atualiza uma instância a partir de uma entrada remota de outro tenant (RN19)", async () => {
    const local = instanciaFake({
      id: "instancia-1",
      uazapiInstanceId: "uaz-1",
      status: "connected",
      numeroConectado: "5511999999999",
      fotoPerfilUrl: "https://pps.whatsapp.net/foto.jpg",
    });
    repo.listar.mockResolvedValueOnce([local]).mockResolvedValueOnce([]);
    // Resposta da UAZAPI (conta inteira) só tem instância de OUTRO tenant — nada bate
    // com o uazapiInstanceId que este escritório já possui localmente, então essa
    // instância é tratada como fantasma (ver teste abaixo) e não como "atualizável".
    client.listarTodasInstancias.mockResolvedValue([
      { id: "uaz-de-outro-escritorio", status: "connected", owner: "5511888888888" },
    ]);

    await instanciaWhatsappService.sincronizarTodas(ctx());

    expect(repo.atualizarConexao).not.toHaveBeenCalled();
    expect(repo.marcarExcluida).toHaveBeenCalledTimes(1);
    expect(repo.marcarExcluida).not.toHaveBeenCalledWith(
      "uaz-de-outro-escritorio",
      expect.anything(),
      expect.anything()
    );
  });

  it("marca como excluída (e loga) uma instância local que não aparece mais na resposta da UAZAPI — instância fantasma", async () => {
    const fantasma = instanciaFake({
      id: "instancia-1",
      nome: "Fantasma",
      uazapiInstanceId: "uaz-1",
    });
    repo.listar.mockResolvedValueOnce([fantasma]).mockResolvedValueOnce([]);
    client.listarTodasInstancias.mockResolvedValue([]);

    const resultado = await instanciaWhatsappService.sincronizarTodas(ctx());

    expect(repo.marcarExcluida).toHaveBeenCalledTimes(1);
    expect(repo.marcarExcluida).toHaveBeenCalledWith(
      "instancia-1",
      expect.any(Date),
      expect.anything()
    );
    expect(logs.registrar).toHaveBeenCalledTimes(1);
    expect(logs.registrar).toHaveBeenCalledWith(
      ctx(),
      expect.objectContaining({
        acao: "excluir",
        entidade: "instancia_whatsapp",
        entidadeId: "instancia-1",
        resumo: expect.stringContaining("Fantasma"),
      }),
      expect.anything()
    );
    expect(resultado).toEqual([]);
  });

  // O token é a única coisa que liga uma campanha antiga à UAZAPI: apagar a linha o
  // destruiria e deixaria a campanha sem canal de controle para sempre.
  it("nunca apaga fisicamente uma instância fantasma — o token é preservado", async () => {
    const fantasma = instanciaFake({ id: "instancia-1", uazapiInstanceId: "uaz-1" });
    repo.listar.mockResolvedValueOnce([fantasma]).mockResolvedValueOnce([]);
    client.listarTodasInstancias.mockResolvedValue([]);

    await instanciaWhatsappService.sincronizarTodas(ctx());

    expect(repo).not.toHaveProperty("delete");
  });

  it("marca várias instâncias fantasma no mesmo lote, uma linha de log por instância", async () => {
    const viva = instanciaFake({ id: "viva", uazapiInstanceId: "uaz-viva", nome: "Viva" });
    const fantasma1 = instanciaFake({ id: "f1", uazapiInstanceId: "uaz-f1", nome: "F1" });
    const fantasma2 = instanciaFake({ id: "f2", uazapiInstanceId: "uaz-f2", nome: "F2" });

    repo.listar.mockResolvedValueOnce([viva, fantasma1, fantasma2]).mockResolvedValueOnce([viva]);
    client.listarTodasInstancias.mockResolvedValue([
      {
        id: "uaz-viva",
        status: viva.status,
        owner: viva.numeroConectado ?? undefined,
        fotoPerfilUrl: viva.fotoPerfilUrl ?? undefined,
      },
    ]);

    await instanciaWhatsappService.sincronizarTodas(ctx());

    expect(repo.marcarExcluida).toHaveBeenCalledTimes(2);
    expect(repo.marcarExcluida).toHaveBeenCalledWith("f1", expect.any(Date), expect.anything());
    expect(repo.marcarExcluida).toHaveBeenCalledWith("f2", expect.any(Date), expect.anything());
    expect(repo.marcarExcluida).not.toHaveBeenCalledWith(
      "viva",
      expect.any(Date),
      expect.anything()
    );
    expect(logs.registrar).toHaveBeenCalledTimes(2);
  });

  // RN20 é sobre escrita real: a linha já está marcada, então re-carimbar a data a cada
  // sincronização só produziria log de auditoria sem mudança nenhuma por trás.
  it("não reescreve nem loga uma instância que já estava marcada como excluída", async () => {
    const jaExcluida = instanciaFake({
      id: "instancia-1",
      uazapiInstanceId: "uaz-1",
      softDeletedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    repo.listar.mockResolvedValueOnce([jaExcluida]).mockResolvedValueOnce([]);
    client.listarTodasInstancias.mockResolvedValue([]);

    await instanciaWhatsappService.sincronizarTodas(ctx());

    expect(repo.marcarExcluida).not.toHaveBeenCalled();
    expect(logs.registrar).not.toHaveBeenCalled();
  });

  it("busca as excluídas na primeira leitura e devolve só as ativas no fim", async () => {
    repo.listar.mockResolvedValueOnce([instanciaFake()]).mockResolvedValueOnce([]);
    client.listarTodasInstancias.mockResolvedValue([]);

    await instanciaWhatsappService.sincronizarTodas(ctx());

    expect(repo.listar).toHaveBeenNthCalledWith(1, "esc-1", { incluirExcluidas: true });
    expect(repo.listar).toHaveBeenNthCalledWith(2, "esc-1");
  });

  // Auto-cura: se a instância sumiu por uma resposta transitoriamente parcial da UAZAPI,
  // ela volta sozinha assim que reaparece — sem isso, o sumiço seria irreversível pela UI.
  it("restaura uma instância soft-deletada que reaparece na UAZAPI com o mesmo status", async () => {
    const excluida = instanciaFake({
      id: "instancia-1",
      nome: "Voltou",
      uazapiInstanceId: "uaz-1",
      softDeletedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    repo.listar.mockResolvedValueOnce([excluida]).mockResolvedValueOnce([excluida]);
    client.listarTodasInstancias.mockResolvedValue([
      {
        id: "uaz-1",
        status: excluida.status,
        owner: excluida.numeroConectado ?? undefined,
        fotoPerfilUrl: excluida.fotoPerfilUrl ?? undefined,
      },
    ]);
    repo.restaurar.mockResolvedValue(instanciaFake({ id: "instancia-1", nome: "Voltou" }));

    await instanciaWhatsappService.sincronizarTodas(ctx());

    expect(repo.restaurar).toHaveBeenCalledWith("instancia-1", expect.anything());
    expect(repo.atualizarConexao).not.toHaveBeenCalled();
    expect(logs.registrar).toHaveBeenCalledTimes(1);
    expect(logs.registrar).toHaveBeenCalledWith(
      ctx(),
      expect.objectContaining({
        acao: "restaurar",
        entidade: "instancia_whatsapp",
        entidadeId: "instancia-1",
        resumo: expect.stringContaining("Voltou"),
      }),
      expect.anything()
    );
  });

  it("restaura e atualiza numa transação só quando a instância volta com status diferente", async () => {
    const excluida = instanciaFake({
      id: "instancia-1",
      uazapiInstanceId: "uaz-1",
      status: "disconnected",
      numeroConectado: null,
      fotoPerfilUrl: null,
      softDeletedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    repo.listar.mockResolvedValueOnce([excluida]).mockResolvedValueOnce([excluida]);
    client.listarTodasInstancias.mockResolvedValue([
      { id: "uaz-1", status: "connected", owner: "5511999999999" },
    ]);
    repo.restaurar.mockResolvedValue(instanciaFake({ id: "instancia-1" }));
    repo.atualizarConexao.mockResolvedValue(instanciaFake({ id: "instancia-1" }));

    await instanciaWhatsappService.sincronizarTodas(ctx());

    expect(repo.restaurar).toHaveBeenCalledTimes(1);
    expect(repo.atualizarConexao).toHaveBeenCalledWith(
      "instancia-1",
      { status: "connected", numeroConectado: "5511999999999", fotoPerfilUrl: null },
      expect.anything()
    );
    expect(logs.registrar).toHaveBeenCalledTimes(1);
  });

  it("não restaura uma instância que reaparece com status fora do enum", async () => {
    const excluida = instanciaFake({
      id: "instancia-1",
      uazapiInstanceId: "uaz-1",
      softDeletedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    repo.listar.mockResolvedValueOnce([excluida]).mockResolvedValueOnce([]);
    client.listarTodasInstancias.mockResolvedValue([
      { id: "uaz-1", status: "estado-que-nao-existe" },
    ]);

    await instanciaWhatsappService.sincronizarTodas(ctx());

    expect(repo.restaurar).not.toHaveBeenCalled();
    expect(logs.registrar).not.toHaveBeenCalled();
  });

  // Sem isso um escritório cujas instâncias foram todas marcadas nunca mais consultaria a
  // UAZAPI — e portanto nunca poderia se recuperar.
  it("consulta a UAZAPI mesmo quando o escritório só tem instâncias excluídas", async () => {
    repo.listar
      .mockResolvedValueOnce([instanciaFake({ softDeletedAt: new Date() })])
      .mockResolvedValueOnce([]);
    client.listarTodasInstancias.mockResolvedValue([]);

    await instanciaWhatsappService.sincronizarTodas(ctx());

    expect(client.listarTodasInstancias).toHaveBeenCalledTimes(1);
  });

  it("atualiza e loga só as instâncias que realmente mudaram — uma linha de log por instância alterada, zero para as que não mudaram", async () => {
    const a = instanciaFake({
      id: "a",
      uazapiInstanceId: "uaz-a",
      nome: "A",
      status: "connecting",
      numeroConectado: null,
      fotoPerfilUrl: null,
    });
    const b = instanciaFake({
      id: "b",
      uazapiInstanceId: "uaz-b",
      nome: "B",
      status: "connected",
      numeroConectado: "5511999999999",
      fotoPerfilUrl: "https://pps.whatsapp.net/foto.jpg",
    });
    const c = instanciaFake({ id: "c", uazapiInstanceId: "uaz-c", nome: "C", status: "connected" });
    const d = instanciaFake({ id: "d", uazapiInstanceId: "uaz-d", nome: "D", status: "disconnected" });

    repo.listar.mockResolvedValueOnce([a, b, c, d]);
    client.listarTodasInstancias.mockResolvedValue([
      { id: "uaz-a", status: "connected", owner: "5511999999999" }, // muda (status + numero)
      {
        id: "uaz-b",
        status: "connected",
        owner: "5511999999999",
        fotoPerfilUrl: "https://pps.whatsapp.net/foto.jpg",
      }, // idêntico ao local, não muda
      { id: "uaz-c", status: "estado-invalido" }, // status fora do enum, deve ser pulado sem travar o lote
      // uaz-d: ausente da resposta remota — instância fantasma, deve ser excluída
    ]);
    repo.atualizarConexao.mockResolvedValue(
      instanciaFake({ id: "a", status: "connected", numeroConectado: "5511999999999" })
    );
    repo.listar.mockResolvedValueOnce([a, b, c]);

    const resultado = await instanciaWhatsappService.sincronizarTodas(ctx());

    expect(client.listarTodasInstancias).toHaveBeenCalledTimes(1);
    expect(repo.atualizarConexao).toHaveBeenCalledTimes(1);
    expect(repo.atualizarConexao).toHaveBeenCalledWith(
      "a",
      { status: "connected", numeroConectado: "5511999999999", fotoPerfilUrl: null },
      expect.anything()
    );
    expect(repo.marcarExcluida).toHaveBeenCalledTimes(1);
    expect(repo.marcarExcluida).toHaveBeenCalledWith("d", expect.any(Date), expect.anything());
    expect(logs.registrar).toHaveBeenCalledTimes(2);
    expect(logs.registrar).toHaveBeenCalledWith(
      ctx(),
      expect.objectContaining({
        acao: "atualizar",
        entidade: "instancia_whatsapp",
        entidadeId: "a",
        resumo: expect.stringContaining("A"),
      }),
      expect.anything()
    );
    expect(logs.registrar).toHaveBeenCalledWith(
      ctx(),
      expect.objectContaining({
        acao: "excluir",
        entidade: "instancia_whatsapp",
        entidadeId: "d",
        resumo: expect.stringContaining("D"),
      }),
      expect.anything()
    );
    expect(resultado).toHaveLength(3);
    for (const item of resultado) {
      expect(item).not.toHaveProperty("uazapiToken");
    }
  });

  // Comportamento-chave que diferencia sincronizarTodas de verificarStatus: uma entrada
  // remota malformada NÃO pode abortar a sincronização do lote inteiro — só ela é pulada.
  it("um status inválido em uma instância do lote não impede a atualização das outras", async () => {
    const bom1 = instanciaFake({ id: "x", uazapiInstanceId: "uaz-x", nome: "X", status: "connecting" });
    const ruim = instanciaFake({ id: "y", uazapiInstanceId: "uaz-y", nome: "Y", status: "connected" });
    const bom2 = instanciaFake({ id: "z", uazapiInstanceId: "uaz-z", nome: "Z", status: "connecting" });

    repo.listar.mockResolvedValueOnce([bom1, ruim, bom2]);
    client.listarTodasInstancias.mockResolvedValue([
      { id: "uaz-x", status: "connected" },
      { id: "uaz-y", status: "estado-que-nao-existe-no-enum" },
      { id: "uaz-z", status: "connected" },
    ]);
    repo.atualizarConexao.mockResolvedValue(instanciaFake());
    repo.listar.mockResolvedValueOnce([bom1, ruim, bom2]);

    await instanciaWhatsappService.sincronizarTodas(ctx());

    expect(repo.atualizarConexao).toHaveBeenCalledTimes(2);
    expect(repo.atualizarConexao).toHaveBeenCalledWith(
      "x",
      expect.objectContaining({ status: "connected" }),
      expect.anything()
    );
    expect(repo.atualizarConexao).toHaveBeenCalledWith(
      "z",
      expect.objectContaining({ status: "connected" }),
      expect.anything()
    );
    expect(repo.atualizarConexao).not.toHaveBeenCalledWith(
      "y",
      expect.anything(),
      expect.anything()
    );
    expect(logs.registrar).toHaveBeenCalledTimes(2);
  });
});

describe("instanciaWhatsappService.desconectar", () => {
  it("rejeita role padrao sem tocar repository ou client", async () => {
    await expect(
      instanciaWhatsappService.desconectar(ctx("padrao"), "instancia-1")
    ).rejects.toThrow(PermissaoNegadaError);
    expect(repo.findById).not.toHaveBeenCalled();
    expect(client.desconectarInstancia).not.toHaveBeenCalled();
  });

  it("trata instância de outro escritório como inexistente (RN19)", async () => {
    repo.findById.mockResolvedValue(instanciaFake({ escritorioId: "esc-2" }));

    await expect(instanciaWhatsappService.desconectar(ctx(), "instancia-1")).rejects.toThrow(
      InstanciaWhatsappNaoEncontradaError
    );
    expect(client.desconectarInstancia).not.toHaveBeenCalled();
  });

  it("rejeita id inexistente", async () => {
    repo.findById.mockResolvedValue(null);
    await expect(instanciaWhatsappService.desconectar(ctx(), "sumida")).rejects.toThrow(
      InstanciaWhatsappNaoEncontradaError
    );
  });

  it("desconecta na UAZAPI com o token salvo, marca disconnected limpando número/foto e loga", async () => {
    repo.findById.mockResolvedValue(instanciaFake({ status: "connected" }));
    client.desconectarInstancia.mockResolvedValue(undefined);
    repo.atualizarConexao.mockResolvedValue(
      instanciaFake({ status: "disconnected", numeroConectado: null, fotoPerfilUrl: null })
    );

    const resultado = await instanciaWhatsappService.desconectar(ctx(), "instancia-1");

    expect(client.desconectarInstancia).toHaveBeenCalledWith("token-secreto");
    expect(repo.atualizarConexao).toHaveBeenCalledWith(
      "instancia-1",
      { status: "disconnected", numeroConectado: null, fotoPerfilUrl: null },
      expect.anything()
    );
    expect(logs.registrar).toHaveBeenCalledWith(
      ctx(),
      expect.objectContaining({
        acao: "atualizar",
        entidade: "instancia_whatsapp",
        entidadeId: "instancia-1",
        resumo: expect.stringContaining("desconectada"),
      }),
      expect.anything()
    );
    expect(resultado).not.toHaveProperty("uazapiToken");
    expect(resultado.status).toBe("disconnected");
  });

  it("não grava nem loga quando a UAZAPI falha", async () => {
    repo.findById.mockResolvedValue(instanciaFake({ status: "connected" }));
    client.desconectarInstancia.mockRejectedValue(new UazapiIndisponivelError());

    await expect(
      instanciaWhatsappService.desconectar(ctx(), "instancia-1")
    ).rejects.toBeInstanceOf(UazapiIndisponivelError);
    expect(repo.atualizarConexao).not.toHaveBeenCalled();
    expect(logs.registrar).not.toHaveBeenCalled();
  });
});

describe("instanciaWhatsappService.excluir", () => {
  it("rejeita role padrao sem tocar repository ou client", async () => {
    await expect(instanciaWhatsappService.excluir(ctx("padrao"), "instancia-1")).rejects.toThrow(
      PermissaoNegadaError
    );
    expect(repo.findById).not.toHaveBeenCalled();
    expect(client.deletarInstancia).not.toHaveBeenCalled();
  });

  it("trata instância de outro escritório como inexistente (RN19), sem deletar nada", async () => {
    repo.findById.mockResolvedValue(instanciaFake({ escritorioId: "esc-2" }));

    await expect(instanciaWhatsappService.excluir(ctx(), "instancia-1")).rejects.toThrow(
      InstanciaWhatsappNaoEncontradaError
    );
    expect(client.deletarInstancia).not.toHaveBeenCalled();
    expect(repo.marcarExcluida).not.toHaveBeenCalled();
  });

  it("rejeita id inexistente", async () => {
    repo.findById.mockResolvedValue(null);
    await expect(instanciaWhatsappService.excluir(ctx(), "sumida")).rejects.toThrow(
      InstanciaWhatsappNaoEncontradaError
    );
  });

  it("remove na UAZAPI com o token salvo, marca a linha local como excluída e loga", async () => {
    repo.findById.mockResolvedValue(instanciaFake());
    client.deletarInstancia.mockResolvedValue(undefined);
    repo.marcarExcluida.mockResolvedValue(instanciaFake());

    await instanciaWhatsappService.excluir(ctx(), "instancia-1");

    expect(client.deletarInstancia).toHaveBeenCalledWith("token-secreto");
    expect(repo.marcarExcluida).toHaveBeenCalledWith(
      "instancia-1",
      expect.any(Date),
      expect.anything()
    );
    expect(logs.registrar).toHaveBeenCalledWith(
      ctx(),
      expect.objectContaining({
        acao: "excluir",
        entidade: "instancia_whatsapp",
        entidadeId: "instancia-1",
        resumo: expect.stringContaining("excluída"),
      }),
      expect.anything()
    );
  });

  // A remoção externa vem antes da local: se a UAZAPI recusar, a instância continua
  // inteira dos dois lados em vez de sumir daqui e ficar órfã lá.
  it("não marca a linha local nem loga quando a UAZAPI falha", async () => {
    repo.findById.mockResolvedValue(instanciaFake());
    client.deletarInstancia.mockRejectedValue(new UazapiIndisponivelError());

    await expect(instanciaWhatsappService.excluir(ctx(), "instancia-1")).rejects.toBeInstanceOf(
      UazapiIndisponivelError
    );
    expect(repo.marcarExcluida).not.toHaveBeenCalled();
    expect(logs.registrar).not.toHaveBeenCalled();
  });

  // Idempotência: sem isso o segundo DELETE chamaria a UAZAPI com um token já morto.
  it("trata instância já excluída como inexistente", async () => {
    repo.findById.mockResolvedValue(instanciaFake({ softDeletedAt: new Date() }));

    await expect(instanciaWhatsappService.excluir(ctx(), "instancia-1")).rejects.toThrow(
      InstanciaWhatsappNaoEncontradaError
    );
    expect(client.deletarInstancia).not.toHaveBeenCalled();
  });
});

describe("instanciaWhatsappService — instância excluída", () => {
  // Esta é a razão de existir do soft delete: a campanha antiga precisa continuar
  // resolvendo o token para poder ser sincronizada, pausada e excluída.
  it("obterComToken continua resolvendo uma instância excluída, com o token", async () => {
    const excluida = instanciaFake({ softDeletedAt: new Date() });
    repo.findById.mockResolvedValue(excluida);

    const resultado = await instanciaWhatsappService.obterComToken(ctx(), "instancia-1");

    expect(resultado.uazapiToken).toBe("token-secreto");
  });

  it("obterAtivaComToken recusa uma instância excluída", async () => {
    repo.findById.mockResolvedValue(instanciaFake({ softDeletedAt: new Date() }));

    await expect(
      instanciaWhatsappService.obterAtivaComToken(ctx(), "instancia-1")
    ).rejects.toThrow(InstanciaWhatsappNaoEncontradaError);
  });

  it("listar só pede as instâncias ativas ao repositório", async () => {
    repo.listar.mockResolvedValue([]);

    await instanciaWhatsappService.listar(ctx());

    expect(repo.listar).toHaveBeenCalledWith("esc-1");
  });

  it.each([
    ["reconectar", () => instanciaWhatsappService.reconectar(ctx(), "instancia-1")],
    ["desconectar", () => instanciaWhatsappService.desconectar(ctx(), "instancia-1")],
    ["verificarStatus", () => instanciaWhatsappService.verificarStatus(ctx(), "instancia-1")],
  ])("%s recusa uma instância excluída sem tocar na UAZAPI", async (_nome, chamar) => {
    repo.findById.mockResolvedValue(instanciaFake({ softDeletedAt: new Date() }));

    await expect(chamar()).rejects.toThrow(InstanciaWhatsappNaoEncontradaError);
    expect(client.conectarInstancia).not.toHaveBeenCalled();
    expect(client.desconectarInstancia).not.toHaveBeenCalled();
    expect(client.consultarStatus).not.toHaveBeenCalled();
  });

  it("criarEConectar explica que o nome está reservado por uma instância excluída", async () => {
    repo.findByNome.mockResolvedValue(instanciaFake({ softDeletedAt: new Date() }));

    const erro: unknown = await instanciaWhatsappService
      .criarEConectar(ctx(), { nome: "Atendimento" })
      .catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(NomeInstanciaDuplicadoError);
    expect((erro as Error).message).toContain("excluída");
    expect(client.criarInstancia).not.toHaveBeenCalled();
  });
});
