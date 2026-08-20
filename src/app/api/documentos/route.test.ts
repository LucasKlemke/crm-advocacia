/**
 * @jest-environment node
 */
import { GET } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { documentoService } from "@/services/documento.service";

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
jest.mock("@/services/documento.service", () => {
  class DocumentoNaoEncontradoError extends Error {}
  class TipoDocumentoInvalidoError extends Error {}
  class TamanhoDocumentoExcedidoError extends Error {}
  return {
    documentoService: { listarPorEscopo: jest.fn() },
    DocumentoNaoEncontradoError,
    TipoDocumentoInvalidoError,
    TamanhoDocumentoExcedidoError,
  };
});
jest.mock("@/services/cliente.service", () => {
  class ClienteNaoEncontradoError extends Error {}
  class CpfInvalidoError extends Error {}
  class CpfDuplicadoError extends Error {}
  class TelefoneInvalidoError extends Error {}
  class EmailInvalidoError extends Error {}
  return {
    ClienteNaoEncontradoError,
    CpfInvalidoError,
    CpfDuplicadoError,
    TelefoneInvalidoError,
    EmailInvalidoError,
  };
});
jest.mock("@/services/caso.service", () => {
  class CasoNaoEncontradoError extends Error {}
  class StatusInvalidoError extends Error {}
  class ClienteNaoAtualError extends Error {}
  return {
    CasoNaoEncontradoError,
    StatusInvalidoError,
    ClienteNaoAtualError,
  };
});

const mockedGetTenantContext = getTenantContext as jest.Mock;
const service = documentoService as jest.Mocked<typeof documentoService>;

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" as const };
const ESCOPO_ID = "550e8400-e29b-41d4-a716-446655440000";

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
});

describe("GET /api/documentos", () => {
  it("lista os documentos do escopo informado", async () => {
    service.listarPorEscopo.mockResolvedValue([{ id: "doc-1" }] as never);

    const resposta = await GET(
      new Request(`http://localhost/api/documentos?escopo=cliente&escopoId=${ESCOPO_ID}`)
    );

    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo.documentos).toEqual([{ id: "doc-1" }]);
    expect(service.listarPorEscopo).toHaveBeenCalledWith(ctx, "cliente", ESCOPO_ID);
  });

  it("recusa query inválida com 400", async () => {
    const resposta = await GET(new Request("http://localhost/api/documentos?escopo=cliente"));
    expect(resposta.status).toBe(400);
    expect(service.listarPorEscopo).not.toHaveBeenCalled();
  });
});
