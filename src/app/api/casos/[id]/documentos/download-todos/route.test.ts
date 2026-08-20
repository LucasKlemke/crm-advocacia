/**
 * @jest-environment node
 */
import { GET } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { casoService, CasoNaoEncontradoError } from "@/services/caso.service";
import { documentoService } from "@/services/documento.service";
import { montarZipDocumentos } from "@/lib/documentos/zip";
import { Readable } from "node:stream";
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
jest.mock("@/services/caso.service", () => ({
  casoService: { obter: jest.fn() },
  CasoNaoEncontradoError: class CasoNaoEncontradoError extends Error {},
}));
jest.mock("@/services/documento.service");
jest.mock("@/lib/documentos/zip");

const ctx: TenantContext = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" };

beforeEach(() => {
  jest.clearAllMocks();
  (getTenantContext as jest.Mock).mockResolvedValue(ctx);
});

describe("GET /api/casos/[id]/documentos/download-todos", () => {
  it("devolve um stream zip com o título do caso no filename", async () => {
    (casoService.obter as jest.Mock).mockResolvedValue({ id: "caso-1", titulo: "Ação de Cobrança" });
    (documentoService.listarPorEscopo as jest.Mock).mockResolvedValue([{ id: "doc-1" }]);
    (montarZipDocumentos as jest.Mock).mockReturnValue(Readable.from([Buffer.from("PK\x03\x04")]));

    const resposta = await GET(new Request("http://localhost/api/casos/caso-1/documentos/download-todos"), {
      params: Promise.resolve({ id: "caso-1" }),
    });

    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("Content-Type")).toBe("application/zip");
    expect(resposta.headers.get("Content-Disposition")).toBe(
      'attachment; filename="documentos-caso-Ação de Cobrança.zip"'
    );
    expect(documentoService.listarPorEscopo).toHaveBeenCalledWith(ctx, "caso", "caso-1");
  });

  it("mapeia CasoNaoEncontradoError para 404", async () => {
    (casoService.obter as jest.Mock).mockRejectedValue(new CasoNaoEncontradoError());

    const resposta = await GET(new Request("http://localhost/api/casos/caso-alheio/documentos/download-todos"), {
      params: Promise.resolve({ id: "caso-alheio" }),
    });
    expect(resposta.status).toBe(404);
  });
});
