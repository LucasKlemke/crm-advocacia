/**
 * @jest-environment node
 */
import { GET, PATCH, DELETE } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { eventoService } from "@/services/evento.service";
import { serializarEvento } from "@/lib/api/serializa-evento";

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
      obter: jest.fn(),
      atualizar: jest.fn(),
      excluir: jest.fn(),
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
jest.mock("@/lib/api/serializa-evento", () => ({
  serializarEvento: jest.fn(async (evento: unknown) => evento),
  serializarEventos: jest.fn(async (eventos: unknown[]) => eventos),
}));

const mockedGetTenantContext = getTenantContext as jest.Mock;
const service = eventoService as jest.Mocked<typeof eventoService>;
const { EventoNaoEncontradoError, PermissaoNegadaError, ModalidadeEventoInvalidaError } =
  jest.requireMock("@/services/evento.service");

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "owner" as const };
const params = Promise.resolve({ id: "evento-1" });

function patch(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/eventos/evento-1", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    { params }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
  service.membroAtual.mockResolvedValue({ id: "membro-1" } as never);
  service.podeEditar.mockReturnValue(true);
  service.obter.mockResolvedValue({ id: "evento-1", titulo: "Audiência" } as never);
  (serializarEvento as jest.Mock).mockImplementation(async (evento: unknown) => evento);
});

describe("GET /api/eventos/[id]", () => {
  it("devolve o evento do escritório", async () => {
    const response = await GET(new Request("http://localhost/api/eventos/evento-1"), { params });
    const corpo = await response.json();

    expect(response.status).toBe(200);
    expect(corpo.evento.id).toBe("evento-1");
  });

  it("responde 404 para evento de outro escritório ou já excluído (RN19/RN34)", async () => {
    service.obter.mockRejectedValueOnce(new EventoNaoEncontradoError("x"));
    const response = await GET(new Request("http://localhost/api/eventos/evento-1"), { params });
    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/eventos/[id]", () => {
  it("atualiza e devolve o evento recarregado", async () => {
    const response = await patch({ titulo: "Audiência remarcada" });
    const corpo = await response.json();

    expect(response.status).toBe(200);
    expect(service.atualizar).toHaveBeenCalledWith(ctx, "evento-1", {
      titulo: "Audiência remarcada",
    });
    expect(corpo.evento.id).toBe("evento-1");
  });

  it("responde 400 para corpo inválido", async () => {
    expect((await patch({ inicio: "ontem" })).status).toBe(400);
    expect(service.atualizar).not.toHaveBeenCalled();
  });

  it("responde 403 para quem não é autor nem gestor (RN34)", async () => {
    service.atualizar.mockRejectedValueOnce(new PermissaoNegadaError("x"));
    expect((await patch({ titulo: "Remarcado" })).status).toBe(403);
  });

  it("responde 422 quando a modalidade fica inconsistente (RN32)", async () => {
    service.atualizar.mockRejectedValueOnce(new ModalidadeEventoInvalidaError("x"));
    expect((await patch({ modalidade: "online" })).status).toBe(422);
  });
});

describe("DELETE /api/eventos/[id]", () => {
  it("exclui e devolve ok", async () => {
    const response = await DELETE(new Request("http://localhost/api/eventos/evento-1"), { params });
    const corpo = await response.json();

    expect(response.status).toBe(200);
    expect(corpo.ok).toBe(true);
    expect(service.excluir).toHaveBeenCalledWith(ctx, "evento-1");
  });

  it("responde 403 para quem não é autor nem gestor (RN34)", async () => {
    service.excluir.mockRejectedValueOnce(new PermissaoNegadaError("x"));
    const response = await DELETE(new Request("http://localhost/api/eventos/evento-1"), {
      params,
    });
    expect(response.status).toBe(403);
  });

  it("responde 404 para evento inexistente", async () => {
    service.excluir.mockRejectedValueOnce(new EventoNaoEncontradoError("x"));
    const response = await DELETE(new Request("http://localhost/api/eventos/evento-1"), {
      params,
    });
    expect(response.status).toBe(404);
  });
});
