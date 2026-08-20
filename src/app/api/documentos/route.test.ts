/**
 * @jest-environment node
 */
import { GET } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { documentoService, DocumentoNaoEncontradoError } from "@/services/documento.service";
import type { Documento } from "@prisma/client";

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
  class TipoInvalidoError extends Error {}
  class DocumentoConflitanteError extends Error {}
  class DocumentoNaoEncontradoError extends Error {
    constructor() {
      super("Documento não encontrado.");
    }
  }
  class TipoDocumentoInvalidoError extends Error {}
  class TamanhoDocumentoExcedidoError extends Error {}
  class PermissaoDocumentoError extends Error {}
  class TamanhoInvalidoError extends Error {}
  return {
    TipoInvalidoError,
    DocumentoConflitanteError,
    documentoService: { listarPorEscopo: jest.fn() },
    DocumentoNaoEncontradoError,
    TipoDocumentoInvalidoError,
    TamanhoDocumentoExcedidoError,
    PermissaoDocumentoError,
    TamanhoInvalidoError,
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
  class ClienteInativoError extends Error {}
  class ResponsavelInvalidoError extends Error {}
  return {
    CasoNaoEncontradoError,
    StatusInvalidoError,
    ClienteNaoAtualError,
    ClienteInativoError,
    ResponsavelInvalidoError,
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

const CRIADO_EM = new Date("2026-08-20T12:00:00.000Z");

function documentoFake(): Documento {
  return {
    id: "doc-1",
    escritorioId: "esc-1",
    escopo: "cliente",
    escopoId: ESCOPO_ID,
    autorMembroId: "membro-1",
    nomeOriginal: "contrato.pdf",
    tipoArquivo: "pdf",
    tamanhoKb: 100,
    storageKey: "development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf",
    softDeletedAt: null,
    createdAt: CRIADO_EM,
    updatedAt: CRIADO_EM,
  };
}

describe("GET /api/documentos", () => {
  it("lista os documentos do escopo informado sem expor campos internos", async () => {
    service.listarPorEscopo.mockResolvedValue([documentoFake()] as never);

    const resposta = await GET(
      new Request(`http://localhost/api/documentos?escopo=cliente&escopoId=${ESCOPO_ID}`)
    );

    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    // `storageKey` e `autorMembroId` não saem na resposta (expõem o layout do bucket e um
    // id interno de membro, e facilitam abuso do fluxo de confirmação).
    expect(corpo.documentos).toEqual([
      {
        id: "doc-1",
        escopo: "cliente",
        escopoId: ESCOPO_ID,
        nomeOriginal: "contrato.pdf",
        tipoArquivo: "pdf",
        tamanhoKb: 100,
        createdAt: CRIADO_EM.toISOString(),
      },
    ]);
    expect(service.listarPorEscopo).toHaveBeenCalledWith(ctx, "cliente", ESCOPO_ID);
  });

  it("recusa query inválida com 400", async () => {
    const resposta = await GET(new Request("http://localhost/api/documentos?escopo=cliente"));
    expect(resposta.status).toBe(400);
    expect(service.listarPorEscopo).not.toHaveBeenCalled();
  });

  it("mapeia erro de documento não encontrado para 404", async () => {
    service.listarPorEscopo.mockRejectedValue(new DocumentoNaoEncontradoError());

    const resposta = await GET(
      new Request(`http://localhost/api/documentos?escopo=cliente&escopoId=${ESCOPO_ID}`)
    );

    expect(resposta.status).toBe(404);
    const corpo = await resposta.json();
    expect(corpo.error).toBe("Documento não encontrado.");
  });

  it("retorna 500 para erro não mapeado", async () => {
    service.listarPorEscopo.mockRejectedValue(new Error("falha inesperada"));

    const resposta = await GET(
      new Request(`http://localhost/api/documentos?escopo=cliente&escopoId=${ESCOPO_ID}`)
    );

    expect(resposta.status).toBe(500);
    const corpo = await resposta.json();
    expect(corpo.error).toBe("Não foi possível listar os documentos.");
  });
});
