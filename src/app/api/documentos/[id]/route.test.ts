/** @jest-environment node */
import { DELETE } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { documentoService, PermissaoDocumentoError } from "@/services/documento.service";
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
    documentoService: { excluir: jest.fn() },
    DocumentoNaoEncontradoError,
    PermissaoDocumentoError,
    TamanhoInvalidoError,
  };
});

const ctx: TenantContext = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" };

beforeEach(() => {
  jest.clearAllMocks();
  (getTenantContext as jest.Mock).mockResolvedValue(ctx);
});

describe("DELETE /api/documentos/[id]", () => {
  it("exclui o documento e devolve ok", async () => {
    (documentoService.excluir as jest.Mock).mockResolvedValue(undefined);

    const resposta = await DELETE(new Request("http://localhost/api/documentos/doc-1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "doc-1" }),
    });

    expect(resposta.status).toBe(200);
    expect(documentoService.excluir).toHaveBeenCalledWith(ctx, "doc-1");
  });

  it("mapeia PermissaoDocumentoError para 403", async () => {
    (documentoService.excluir as jest.Mock).mockRejectedValue(new PermissaoDocumentoError());

    const resposta = await DELETE(new Request("http://localhost/api/documentos/doc-1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(resposta.status).toBe(403);
  });
});
