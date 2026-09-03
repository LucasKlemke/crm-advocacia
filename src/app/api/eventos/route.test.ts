/**
 * @jest-environment node
 */
import { GET, POST } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { eventoService } from "@/services/evento.service";
import { serializarEvento, serializarEventos } from "@/lib/api/serializa-evento";

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
jest.mock("@/services/evento.service", () => {
  class EventoNaoEncontradoError extends Error {}
  class VinculoEventoExclusivoError extends Error {}
  class ModalidadeEventoInvalidaError extends Error {}
  class ParticipanteInvalidoError extends Error {}
  class MembroDaSessaoInvalidoError extends Error {}
  class PermissaoNegadaError extends Error {}
  return {
    eventoService: {
      listarNoPeriodo: jest.fn(),
      criar: jest.fn(),
      obter: jest.fn(),
      membroAtual: jest.fn(),
      podeEditar: jest.fn(() => true),
    },
    EventoNaoEncontradoError,
    VinculoEventoExclusivoError,
    ModalidadeEventoInvalidaError,
    ParticipanteInvalidoError,
    MembroDaSessaoInvalidoError,
    PermissaoNegadaError,
  };
});
// O mock aplica o callback de permissão de verdade: é ele que leva `podeEditar` ao
// DTO (RN34), e um mock que ignora o callback esconderia a rota passando o membro errado.
jest.mock("@/lib/api/serializa-evento", () => ({
  serializarEventos: jest.fn(
    async (eventos: Record<string, unknown>[], podeEditar: (e: unknown) => boolean) =>
      eventos.map((evento) => ({ ...evento, podeEditar: podeEditar(evento) }))
  ),
  serializarEvento: jest.fn(
    async (evento: Record<string, unknown>, podeEditar: (e: unknown) => boolean) => ({
      ...evento,
      podeEditar: podeEditar(evento),
    })
  ),
}));

const mockedGetTenantContext = getTenantContext as jest.Mock;
const service = eventoService as jest.Mocked<typeof eventoService>;
const {
  VinculoEventoExclusivoError,
  ModalidadeEventoInvalidaError,
  ParticipanteInvalidoError,
  PermissaoNegadaError,
} = jest.requireMock("@/services/evento.service");
const { NaoAutenticadoError } = jest.requireMock("@/lib/auth/tenant-context");

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "owner" as const };
const PERIODO = "inicio=2026-09-01T00:00:00.000Z&fim=2026-09-30T23:59:59.999Z";
const VALIDO = {
  titulo: "Audiência de instrução",
  inicio: "2026-09-10T13:00:00.000Z",
  fim: "2026-09-10T14:00:00.000Z",
  modalidade: "presencial",
  local: "Fórum de Joinville",
};

function get(query: string) {
  return GET(new Request(`http://localhost/api/eventos?${query}`));
}

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/eventos", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
  service.membroAtual.mockResolvedValue({ id: "membro-1" } as never);
  service.podeEditar.mockReturnValue(true);
  (serializarEventos as jest.Mock).mockImplementation(
    async (eventos: Record<string, unknown>[], podeEditar: (e: unknown) => boolean) =>
      eventos.map((evento) => ({ ...evento, podeEditar: podeEditar(evento) }))
  );
  (serializarEvento as jest.Mock).mockImplementation(
    async (evento: Record<string, unknown>, podeEditar: (e: unknown) => boolean) => ({
      ...evento,
      podeEditar: podeEditar(evento),
    })
  );
});

describe("GET /api/eventos", () => {
  it("lista os eventos do período", async () => {
    service.listarNoPeriodo.mockResolvedValue([{ id: "evento-1" }] as never);

    const response = await get(PERIODO);
    const corpo = await response.json();

    expect(response.status).toBe(200);
    expect(corpo.eventos).toHaveLength(1);
    expect(service.listarNoPeriodo).toHaveBeenCalledWith(ctx, {
      inicio: new Date("2026-09-01T00:00:00.000Z"),
      fim: new Date("2026-09-30T23:59:59.999Z"),
    });
  });

  it("responde 400 sem o período ou com período invertido", async () => {
    expect((await get("inicio=2026-09-01T00:00:00.000Z")).status).toBe(400);
    expect(
      (await get("inicio=2026-09-30T00:00:00.000Z&fim=2026-09-01T00:00:00.000Z")).status
    ).toBe(400);
    expect(service.listarNoPeriodo).not.toHaveBeenCalled();
  });

  it("resolve podeEditar por evento com o membro da sessão (RN34)", async () => {
    service.listarNoPeriodo.mockResolvedValue([{ id: "evento-1" }] as never);
    service.podeEditar.mockReturnValue(false);

    const corpo = await (await get(PERIODO)).json();

    expect(corpo.eventos[0].podeEditar).toBe(false);
    expect(service.podeEditar).toHaveBeenCalledWith(ctx, "membro-1", { id: "evento-1" });
  });

  it("responde 401 sem sessão", async () => {
    mockedGetTenantContext.mockRejectedValue(new NaoAutenticadoError());
    expect((await get(PERIODO)).status).toBe(401);
  });
});

describe("POST /api/eventos", () => {
  it("cria o evento e devolve 201 com o evento hidratado", async () => {
    service.criar.mockResolvedValue({ id: "evento-1" } as never);
    service.obter.mockResolvedValue({ id: "evento-1", titulo: VALIDO.titulo } as never);

    const response = await post(VALIDO);
    const corpo = await response.json();

    expect(response.status).toBe(201);
    expect(corpo.evento.id).toBe("evento-1");
    expect(service.criar).toHaveBeenCalledWith(ctx, expect.objectContaining(VALIDO));
  });

  it("responde 400 para corpo inválido e para JSON malformado", async () => {
    expect((await post({ ...VALIDO, titulo: "" })).status).toBe(400);
    const malformado = await POST(
      new Request("http://localhost/api/eventos", { method: "POST", body: "{ nao json" })
    );
    expect(malformado.status).toBe(400);
    expect(service.criar).not.toHaveBeenCalled();
  });

  it("responde 422 quando o vínculo, a modalidade ou o participante violam a regra", async () => {
    service.criar.mockRejectedValueOnce(new VinculoEventoExclusivoError("x"));
    expect((await post(VALIDO)).status).toBe(422);

    service.criar.mockRejectedValueOnce(new ModalidadeEventoInvalidaError("x"));
    expect((await post(VALIDO)).status).toBe(422);

    service.criar.mockRejectedValueOnce(new ParticipanteInvalidoError("x"));
    expect((await post(VALIDO)).status).toBe(422);
  });

  it("responde 403 quando o vínculo com o escritório não está mais ativo", async () => {
    service.criar.mockRejectedValueOnce(new PermissaoNegadaError("x"));
    expect((await post(VALIDO)).status).toBe(403);
  });

  it("responde 500 em erro inesperado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    service.criar.mockRejectedValueOnce(new Error("boom"));
    expect((await post(VALIDO)).status).toBe(500);
  });
});
