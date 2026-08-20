/**
 * @jest-environment node
 */
import { GET } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { documentoService, DocumentoNaoEncontradoError } from "@/services/documento.service";

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
  return {
    TipoInvalidoError,
    DocumentoConflitanteError,
    documentoService: { gerarUrlDownload: jest.fn() },
    DocumentoNaoEncontradoError,
  };
});

const mockedGetTenantContext = getTenantContext as jest.Mock;
const service = documentoService as jest.Mocked<typeof documentoService>;

const ctx = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" as const };

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTenantContext.mockResolvedValue(ctx);
});

describe("GET /api/documentos/[id]/download-url", () => {
  it("devolve a URL assinada de download", async () => {
    service.gerarUrlDownload.mockResolvedValue("https://bucket.s3.amazonaws.com/signed-get");

    const resposta = await GET(new Request("http://localhost/api/documentos/doc-1/download-url"), {
      params: Promise.resolve({ id: "doc-1" }),
    });

    expect(resposta.status).toBe(200);
    const corpo = await resposta.json();
    expect(corpo).toEqual({ downloadUrl: "https://bucket.s3.amazonaws.com/signed-get" });
  });

  it("mapeia DocumentoNaoEncontradoError para 404", async () => {
    service.gerarUrlDownload.mockRejectedValue(new DocumentoNaoEncontradoError());

    const resposta = await GET(new Request("http://localhost/api/documentos/doc-alheio/download-url"), {
      params: Promise.resolve({ id: "doc-alheio" }),
    });
    expect(resposta.status).toBe(404);
  });
});
