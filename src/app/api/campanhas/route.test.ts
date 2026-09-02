/**
 * @jest-environment node
 */
import { GET, POST } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { campanhaService } from "@/services/campanha.service";

jest.mock("@/lib/auth/tenant-context", () => {
  class NaoAutenticadoError extends Error {}
  class SemEscritorioAtivoError extends Error {}
  class AcessoNegadoError extends Error {}
  return {
    getTenantContext: jest.fn(),
    NaoAutenticadoError,
    SemEscritorioAtivoError,
    AcessoNegadoError,
  };
});
jest.mock("@/services/campanha.service", () => {
  class CampanhaNaoEncontradaError extends Error {}
  class CampanhaSemInstanciaError extends Error {}
  class DestinatariosInvalidosError extends Error {}
  class InstanciaNaoConectadaError extends Error {}
  class PermissaoNegadaError extends Error {}
  class VariavelSemColunaError extends Error {}
  return {
    campanhaService: { listar: jest.fn(), criar: jest.fn() },
    CampanhaNaoEncontradaError,
    CampanhaSemInstanciaError,
    DestinatariosInvalidosError,
    InstanciaNaoConectadaError,
    PermissaoNegadaError,
    VariavelSemColunaError,
  };
});
jest.mock("@/services/instancia-whatsapp.service", () => {
  class InstanciaWhatsappNaoEncontradaError extends Error {}
  return { InstanciaWhatsappNaoEncontradaError };
});
jest.mock("@/lib/external/uazapi-client", () => {
  class UazapiIndisponivelError extends Error {}
  return { uazapiClient: {}, UazapiIndisponivelError };
});

const mockedGetTenantContext = getTenantContext as jest.Mock;
const service = campanhaService as jest.Mocked<typeof campanhaService>;

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "owner" as const };

const CORPO_VALIDO = {
  nome: "Campanha de teste",
  instanciaId: "3f2c1b7e-9a4d-4c8b-9f1e-2d3a4b5c6d7e",
  mensagemTemplate: "Olá {{nome}}",
  colunaNumero: "numero",
  mapeamentoVariaveis: { nome: { coluna: "Nome", tratamentos: [] } },
  delayMin: 3,
  delayMax: 6,
  linhas: [{ Nome: "Ana", numero: "5511999999999" }],
};

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/campanhas", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
});

describe("GET /api/campanhas", () => {
  it("retorna 401 sem sessão", async () => {
    const { NaoAutenticadoError } = jest.requireMock("@/lib/auth/tenant-context");
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());

    expect((await GET()).status).toBe(401);
  });

  it("lista as campanhas do escritório da sessão", async () => {
    service.listar.mockResolvedValue([{ id: "campanha-1" }] as never);

    const response = await GET();

    expect(service.listar).toHaveBeenCalledWith(ctx);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ campanhas: [{ id: "campanha-1" }] });
  });

  it("retorna 500 genérico quando o service quebra por um motivo inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.listar.mockRejectedValue(new Error("boom"));

    expect((await GET()).status).toBe(500);
  });
});

describe("POST /api/campanhas", () => {
  it("cria a campanha e devolve 201", async () => {
    service.criar.mockResolvedValue({ id: "campanha-1" } as never);

    const response = await post(CORPO_VALIDO);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ campanha: { id: "campanha-1" } });
  });

  it("converte agendadaPara de ISO para Date antes de chamar o service", async () => {
    service.criar.mockResolvedValue({ id: "campanha-1" } as never);

    await post({ ...CORPO_VALIDO, agendadaPara: "2026-03-01T12:00:00.000Z" });

    expect(service.criar).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ agendadaPara: new Date("2026-03-01T12:00:00.000Z") })
    );
  });

  it("não repassa agendadaPara quando o corpo não traz agendamento", async () => {
    service.criar.mockResolvedValue({ id: "campanha-1" } as never);

    await post(CORPO_VALIDO);

    expect(service.criar.mock.calls[0][1]).not.toHaveProperty("agendadaPara");
  });

  it("retorna 400 com body malformado", async () => {
    const response = await POST(
      new Request("http://localhost/api/campanhas", { method: "POST", body: "{nao-e-json" })
    );

    expect(response.status).toBe(400);
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("retorna 400 quando falta campo obrigatório", async () => {
    const semNome = { ...CORPO_VALIDO, nome: undefined };

    expect((await post(semNome)).status).toBe(400);
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("retorna 400 quando delayMax é menor que delayMin", async () => {
    expect((await post({ ...CORPO_VALIDO, delayMin: 10, delayMax: 2 })).status).toBe(400);
  });

  it("retorna 400 quando a lista de destinatários vem vazia", async () => {
    expect((await post({ ...CORPO_VALIDO, linhas: [] })).status).toBe(400);
  });

  it("retorna 403 para role sem permissão de gestão", async () => {
    const { PermissaoNegadaError } = jest.requireMock("@/services/campanha.service");
    service.criar.mockRejectedValue(new PermissaoNegadaError("sem permissão"));

    expect((await post(CORPO_VALIDO)).status).toBe(403);
  });

  it("retorna 409 quando a instância não está conectada", async () => {
    const { InstanciaNaoConectadaError } = jest.requireMock("@/services/campanha.service");
    service.criar.mockRejectedValue(new InstanciaNaoConectadaError("desconectada"));

    expect((await post(CORPO_VALIDO)).status).toBe(409);
  });

  it("retorna 400 quando uma variável ficou sem coluna", async () => {
    const { VariavelSemColunaError } = jest.requireMock("@/services/campanha.service");
    service.criar.mockRejectedValue(new VariavelSemColunaError("sem coluna"));

    expect((await post(CORPO_VALIDO)).status).toBe(400);
  });

  it("retorna 400 quando há número inválido na planilha", async () => {
    const { DestinatariosInvalidosError } = jest.requireMock("@/services/campanha.service");
    service.criar.mockRejectedValue(new DestinatariosInvalidosError("linha 2"));

    expect((await post(CORPO_VALIDO)).status).toBe(400);
  });

  it("retorna 502 quando a UAZAPI está indisponível", async () => {
    const { UazapiIndisponivelError } = jest.requireMock("@/lib/external/uazapi-client");
    service.criar.mockRejectedValue(new UazapiIndisponivelError("fora do ar"));

    expect((await post(CORPO_VALIDO)).status).toBe(502);
  });
});
