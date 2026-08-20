/**
 * @jest-environment node
 */
import { POST } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { documentoService } from "@/services/documento.service";
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
  class DocumentoNaoEncontradoError extends Error {}
  class PermissaoDocumentoError extends Error {}
  class TamanhoInvalidoError extends Error {}
  return {
    documentoService: { confirmarUpload: jest.fn() },
    DocumentoNaoEncontradoError,
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
  class CasoPertenceAOutroClienteError extends Error {}
  return {
    CasoNaoEncontradoError,
    CasoPertenceAOutroClienteError,
  };
});

const ctx: TenantContext = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" };

function request(body: unknown) {
  return new Request("http://localhost/api/documentos/doc-1/confirmar", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

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
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (getTenantContext as jest.Mock).mockResolvedValue(ctx);
});

describe("POST /api/documentos/[id]/confirmar", () => {
  it("confirma o upload e devolve o documento criado", async () => {
    (documentoService.confirmarUpload as jest.Mock).mockResolvedValue(documentoFake());

    const resposta = await POST(
      request({
        escopo: "cliente",
        escopoId: "550e8400-e29b-41d4-a716-446655440000",
        nomeArquivo: "contrato.pdf",
        tipoArquivo: "pdf",
        tamanhoKb: 100,
        storageKey: "development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf",
      }),
      { params: Promise.resolve({ id: "doc-1" }) }
    );

    expect(resposta.status).toBe(201);
    expect(documentoService.confirmarUpload).toHaveBeenCalledWith(
      ctx,
      "doc-1",
      expect.objectContaining({ storageKey: "development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf" })
    );
  });

  it("recusa payload inválido com 400", async () => {
    const resposta = await POST(request({ escopo: "cliente" }), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(resposta.status).toBe(400);
    expect(documentoService.confirmarUpload).not.toHaveBeenCalled();
  });
});
