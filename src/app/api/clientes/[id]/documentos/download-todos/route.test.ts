/**
 * @jest-environment node
 */
import { GET } from "./route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { clienteService, ClienteNaoEncontradoError } from "@/services/cliente.service";
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
jest.mock("@/services/cliente.service", () => ({
  clienteService: { obter: jest.fn() },
  ClienteNaoEncontradoError: class ClienteNaoEncontradoError extends Error {},
}));
jest.mock("@/services/documento.service");
jest.mock("@/lib/documentos/zip");

const ctx: TenantContext = { usuarioId: "user-1", escritorioId: "esc-1", role: "padrao" };

beforeEach(() => {
  jest.clearAllMocks();
  (getTenantContext as jest.Mock).mockResolvedValue(ctx);
});

describe("GET /api/clientes/[id]/documentos/download-todos", () => {
  it("devolve um stream zip com o nome do cliente no filename", async () => {
    (clienteService.obter as jest.Mock).mockResolvedValue({ id: "cli-1", nome: "Maria Silva" });
    (documentoService.listarPorEscopo as jest.Mock).mockResolvedValue([{ id: "doc-1" }]);
    (montarZipDocumentos as jest.Mock).mockReturnValue(Readable.from([Buffer.from("PK\x03\x04")]));

    const resposta = await GET(new Request("http://localhost/api/clientes/cli-1/documentos/download-todos"), {
      params: Promise.resolve({ id: "cli-1" }),
    });

    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("Content-Type")).toBe("application/zip");
    expect(resposta.headers.get("Content-Disposition")).toBe(
      'attachment; filename="documentos-cliente-Maria Silva.zip"'
    );
    expect(documentoService.listarPorEscopo).toHaveBeenCalledWith(ctx, "cliente", "cli-1");
  });

  it("mapeia ClienteNaoEncontradoError para 404", async () => {
    (clienteService.obter as jest.Mock).mockRejectedValue(new ClienteNaoEncontradoError());

    const resposta = await GET(new Request("http://localhost/api/clientes/cli-alheio/documentos/download-todos"), {
      params: Promise.resolve({ id: "cli-alheio" }),
    });
    expect(resposta.status).toBe(404);
  });
});
