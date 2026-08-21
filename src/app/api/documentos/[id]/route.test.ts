/** @jest-environment node */
import { DELETE, PATCH } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import {
  documentoService,
  PermissaoDocumentoError,
  TipoInvalidoError,
} from "@/services/documento.service";
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
  class DocumentoNaoEncontradoError extends Error {}
  class PermissaoDocumentoError extends Error {}
  class TamanhoInvalidoError extends Error {}
  return {
    TipoInvalidoError,
    DocumentoConflitanteError,
    documentoService: { excluir: jest.fn(), renomear: jest.fn() },
    DocumentoNaoEncontradoError,
    PermissaoDocumentoError,
    TamanhoInvalidoError,
  };
});

const ctx: TenantContext = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" };

function documentoFake(): Documento {
  return {
    id: "doc-1",
    escritorioId: "esc-1",
    escopo: "cliente",
    escopoId: "cli-1",
    autorMembroId: "membro-1",
    nomeOriginal: "novo-nome.pdf",
    tipoArquivo: "pdf",
    tamanhoKb: 100,
    storageKey: "development/esc-1/documentos/cliente/cli-1/doc-1-novo-nome.pdf",
    softDeletedAt: null,
    createdAt: new Date("2026-08-20T12:00:00.000Z"),
    updatedAt: new Date("2026-08-20T12:00:00.000Z"),
  };
}

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/documentos/doc-1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

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

describe("PATCH /api/documentos/[id]", () => {
  it("renomeia o documento e devolve os campos públicos", async () => {
    (documentoService.renomear as jest.Mock).mockResolvedValue(documentoFake());

    const resposta = await PATCH(patchRequest({ nomeArquivo: "novo-nome.pdf" }), {
      params: Promise.resolve({ id: "doc-1" }),
    });

    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo.documento).toMatchObject({ id: "doc-1", nomeOriginal: "novo-nome.pdf" });
    expect(documentoService.renomear).toHaveBeenCalledWith(ctx, "doc-1", "novo-nome.pdf");
  });

  it.each([["../../../etc/passwd"], ["a/b.pdf"], ["..\\windows\\system32"], [".oculto.pdf"]])(
    "recusa nome de arquivo com travessia de caminho (%s) com 400",
    async (nomeArquivo) => {
      const resposta = await PATCH(patchRequest({ nomeArquivo }), {
        params: Promise.resolve({ id: "doc-1" }),
      });

      expect(resposta.status).toBe(400);
      expect(documentoService.renomear).not.toHaveBeenCalled();
    }
  );

  it("recusa payload inválido com 400", async () => {
    const resposta = await PATCH(patchRequest({}), { params: Promise.resolve({ id: "doc-1" }) });
    expect(resposta.status).toBe(400);
    expect(documentoService.renomear).not.toHaveBeenCalled();
  });

  it("mapeia TipoInvalidoError para 400", async () => {
    (documentoService.renomear as jest.Mock).mockRejectedValue(new TipoInvalidoError());

    const resposta = await PATCH(patchRequest({ nomeArquivo: "novo-nome.docx" }), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(resposta.status).toBe(400);
  });

  it("mapeia PermissaoDocumentoError para 403", async () => {
    (documentoService.renomear as jest.Mock).mockRejectedValue(new PermissaoDocumentoError());

    const resposta = await PATCH(patchRequest({ nomeArquivo: "novo-nome.pdf" }), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(resposta.status).toBe(403);
  });
});
