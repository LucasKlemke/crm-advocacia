/**
 * @jest-environment node
 */
import { POST } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { documentoService, DocumentoNaoEncontradoError } from "@/services/documento.service";
import type { TenantContext } from "@/lib/auth/tenant-context";
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
  class PermissaoDocumentoError extends Error {}
  class TamanhoInvalidoError extends Error {}
  class TipoDocumentoInvalidoError extends Error {}
  class TamanhoDocumentoExcedidoError extends Error {}
  return {
    TipoInvalidoError,
    DocumentoConflitanteError,
    documentoService: { confirmarUpload: jest.fn() },
    DocumentoNaoEncontradoError,
    PermissaoDocumentoError,
    TamanhoInvalidoError,
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
  class CasoPertenceAOutroClienteError extends Error {}
  class ClienteInativoError extends Error {}
  class ResponsavelInvalidoError extends Error {}
  return {
    CasoNaoEncontradoError,
    CasoPertenceAOutroClienteError,
    ClienteInativoError,
    ResponsavelInvalidoError,
  };
});

const ctx: TenantContext = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" };

function request(body: unknown) {
  return new Request("http://localhost/api/documentos/doc-1/confirmar", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const CRIADO_EM = new Date("2026-08-20T12:00:00.000Z");

function documentoFake(): Documento {
  return {
    id: "doc-1",
    escritorioId: "esc-1",
    escopo: "cliente",
    escopoId: "cli-1",
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

beforeEach(() => {
  jest.clearAllMocks();
  (getTenantContext as jest.Mock).mockResolvedValue(ctx);
});

describe("POST /api/documentos/[id]/confirmar", () => {
  it("confirma o upload sem receber storageKey e devolve só os campos públicos", async () => {
    (documentoService.confirmarUpload as jest.Mock).mockResolvedValue(documentoFake());

    const resposta = await POST(
      request({
        escopo: "cliente",
        escopoId: "550e8400-e29b-41d4-a716-446655440000",
        nomeArquivo: "contrato.pdf",
        tipoArquivo: "pdf",
        tamanhoKb: 100,
      }),
      { params: Promise.resolve({ id: "doc-1" }) }
    );

    expect(resposta.status).toBe(201);
    const corpo = await resposta.json();
    expect(corpo.documento).toEqual({
      id: "doc-1",
      escopo: "cliente",
      escopoId: "cli-1",
      nomeOriginal: "contrato.pdf",
      tipoArquivo: "pdf",
      tamanhoKb: 100,
      createdAt: CRIADO_EM.toISOString(),
    });
    // A key é derivada pela Service a partir do id da URL; a rota não repassa nada disso.
    expect(documentoService.confirmarUpload).toHaveBeenCalledWith(ctx, "doc-1", {
      escopo: "cliente",
      escopoId: "550e8400-e29b-41d4-a716-446655440000",
      nomeArquivo: "contrato.pdf",
      tipoArquivo: "pdf",
      tamanhoKb: 100,
    });
  });

  it("ignora storageKey enviado pelo cliente", async () => {
    (documentoService.confirmarUpload as jest.Mock).mockResolvedValue(documentoFake());

    await POST(
      request({
        escopo: "cliente",
        escopoId: "550e8400-e29b-41d4-a716-446655440000",
        nomeArquivo: "contrato.pdf",
        tipoArquivo: "pdf",
        tamanhoKb: 100,
        storageKey: "development/esc-alheio/documentos/cliente/cli-9/doc-9-segredo.pdf",
      }),
      { params: Promise.resolve({ id: "doc-1" }) }
    );

    expect(documentoService.confirmarUpload).toHaveBeenCalledWith(
      ctx,
      "doc-1",
      expect.not.objectContaining({ storageKey: expect.anything() })
    );
  });

  it.each([["../../../etc/passwd"], ["a/b.pdf"], ["..\\windows\\system32"], [".oculto.pdf"]])(
    "recusa nome de arquivo com travessia de caminho (%s) com 400",
    async (nomeArquivo) => {
      const resposta = await POST(
        request({
          escopo: "cliente",
          escopoId: "550e8400-e29b-41d4-a716-446655440000",
          nomeArquivo,
          tipoArquivo: "pdf",
          tamanhoKb: 100,
        }),
        { params: Promise.resolve({ id: "doc-1" }) }
      );

      expect(resposta.status).toBe(400);
      expect(documentoService.confirmarUpload).not.toHaveBeenCalled();
    }
  );

  it("recusa payload inválido com 400", async () => {
    const resposta = await POST(request({ escopo: "cliente" }), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(resposta.status).toBe(400);
    expect(documentoService.confirmarUpload).not.toHaveBeenCalled();
  });

  it("mapeia erro de documento não encontrado para 404", async () => {
    (documentoService.confirmarUpload as jest.Mock).mockRejectedValue(
      new DocumentoNaoEncontradoError()
    );

    const resposta = await POST(
      request({
        escopo: "cliente",
        escopoId: "550e8400-e29b-41d4-a716-446655440000",
        nomeArquivo: "contrato.pdf",
        tipoArquivo: "pdf",
        tamanhoKb: 100,
      }),
      { params: Promise.resolve({ id: "doc-1" }) }
    );

    expect(resposta.status).toBe(404);
    const corpo = await resposta.json();
    expect(corpo.error).toBe("Documento não encontrado.");
  });

  it("retorna 500 para erro não mapeado", async () => {
    (documentoService.confirmarUpload as jest.Mock).mockRejectedValue(
      new Error("falha inesperada")
    );

    const resposta = await POST(
      request({
        escopo: "cliente",
        escopoId: "550e8400-e29b-41d4-a716-446655440000",
        nomeArquivo: "contrato.pdf",
        tipoArquivo: "pdf",
        tamanhoKb: 100,
      }),
      { params: Promise.resolve({ id: "doc-1" }) }
    );

    expect(resposta.status).toBe(500);
    const corpo = await resposta.json();
    expect(corpo.error).toBe("Não foi possível confirmar o upload.");
  });
});
