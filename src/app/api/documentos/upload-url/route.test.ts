/**
 * @jest-environment node
 */
import { POST } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { documentoService, TamanhoInvalidoError } from "@/services/documento.service";
import { ClienteNaoEncontradoError } from "@/services/cliente.service";
import type { TenantContext } from "@/lib/auth/tenant-context";

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
    documentoService: { gerarUrlUpload: jest.fn() },
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

const ctx: TenantContext = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" };

function request(body: unknown) {
  return new Request("http://localhost/api/documentos/upload-url", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (getTenantContext as jest.Mock).mockResolvedValue(ctx);
});

describe("POST /api/documentos/upload-url", () => {
  it("devolve documentoId, uploadUrl e storageKey", async () => {
    (documentoService.gerarUrlUpload as jest.Mock).mockResolvedValue({
      documentoId: "doc-1",
      uploadUrl: "https://bucket.s3.amazonaws.com/signed-put",
      storageKey: "development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf",
    });

    const resposta = await POST(
      request({
        escopo: "cliente",
        escopoId: "550e8400-e29b-41d4-a716-446655440000",
        nomeArquivo: "contrato.pdf",
        tipoArquivo: "pdf",
        tamanhoKb: 100,
      })
    );

    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo).toEqual({
      documentoId: "doc-1",
      uploadUrl: "https://bucket.s3.amazonaws.com/signed-put",
      storageKey: "development/esc-1/documentos/cliente/cli-1/doc-1-contrato.pdf",
    });
  });

  it("recusa payload inválido com 400", async () => {
    const resposta = await POST(request({ escopo: "cliente" }));
    expect(resposta.status).toBe(400);
    expect(documentoService.gerarUrlUpload).not.toHaveBeenCalled();
  });

  it("mapeia TamanhoInvalidoError para 400", async () => {
    (documentoService.gerarUrlUpload as jest.Mock).mockRejectedValue(new TamanhoInvalidoError());

    const resposta = await POST(
      request({
        escopo: "cliente",
        escopoId: "550e8400-e29b-41d4-a716-446655440000",
        nomeArquivo: "grande.pdf",
        tipoArquivo: "pdf",
        tamanhoKb: 99999,
      })
    );
    expect(resposta.status).toBe(400);
  });

  it("mapeia ClienteNaoEncontradoError para 404", async () => {
    (documentoService.gerarUrlUpload as jest.Mock).mockRejectedValue(new ClienteNaoEncontradoError());

    const resposta = await POST(
      request({
        escopo: "cliente",
        escopoId: "550e8400-e29b-41d4-a716-446655440000",
        nomeArquivo: "contrato.pdf",
        tipoArquivo: "pdf",
        tamanhoKb: 100,
      })
    );
    expect(resposta.status).toBe(404);
  });
});
