import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import {
  chaveDocumentos,
  useDocumentos,
  useEnviarDocumento,
  useExcluirDocumento,
  useRenomearDocumento,
} from "./use-documentos";
import type { DocumentoDTO } from "@/types/documento";

function criarWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return { queryClient, Wrapper };
}

const DOCUMENTO: DocumentoDTO = {
  id: "doc-1",
  escopo: "caso",
  escopoId: "caso-1",
  nomeOriginal: "contrato.pdf",
  tipoArquivo: "pdf",
  tamanhoKb: 120,
  createdAt: "2026-08-01T12:00:00.000Z",
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

describe("chaveDocumentos", () => {
  it("monta a chave a partir de escopo e escopoId", () => {
    expect(chaveDocumentos("caso", "caso-1")).toEqual(["documentos", "caso", "caso-1"]);
  });
});

describe("useDocumentos", () => {
  it("busca a lista em /api/documentos com escopo e escopoId", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ documentos: [DOCUMENTO] }),
    } as Response);

    const { Wrapper } = criarWrapper();
    const { result } = renderHook(() => useDocumentos("caso", "caso-1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data).toEqual({ documentos: [DOCUMENTO] }));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/documentos?escopo=caso&escopoId=caso-1",
      expect.anything()
    );
  });

  it("não busca quando escopoId é null", () => {
    const { Wrapper } = criarWrapper();
    const { result } = renderHook(() => useDocumentos("caso", null), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("useEnviarDocumento", () => {
  it("faz upload-url, PUT no S3 e confirmar, e invalida a lista", async () => {
    const arquivo = new File(["conteudo"], "contrato.pdf", { type: "application/pdf" });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          documentoId: "doc-1",
          uploadUrl: "https://s3.example.com/upload",
          storageKey: "key",
        }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ documento: DOCUMENTO }),
      } as Response);

    const { Wrapper, queryClient } = criarWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useEnviarDocumento("caso", "caso-1"), {
      wrapper: Wrapper,
    });

    result.current.mutate(arquivo);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const chamadas = (global.fetch as jest.Mock).mock.calls;
    expect(chamadas[0][0]).toBe("/api/documentos/upload-url");
    expect(JSON.parse(chamadas[0][1].body)).toEqual({
      escopo: "caso",
      escopoId: "caso-1",
      nomeArquivo: "contrato.pdf",
      tipoArquivo: "pdf",
      tamanhoBytes: arquivo.size,
    });

    expect(chamadas[1][0]).toBe("https://s3.example.com/upload");
    expect(chamadas[1][1].method).toBe("PUT");

    expect(chamadas[2][0]).toBe("/api/documentos/doc-1/confirmar");
    expect(chamadas[2][1].method).toBe("POST");

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: chaveDocumentos("caso", "caso-1"),
    });
  });

  // Bug: Content-Length é um header assinado pela URL do S3. Se o cliente mandasse o
  // tamanho arredondado em KB em vez do tamanho exato do arquivo, o PUT real (que sempre
  // carrega o Content-Length exato) divergiria da assinatura e o S3 devolveria 403.
  it("envia o tamanho exato em bytes, mesmo quando não é múltiplo de 1024", async () => {
    const arquivo = new File(["x".repeat(84887)], "contrato.pdf", { type: "application/pdf" });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          documentoId: "doc-1",
          uploadUrl: "https://s3.example.com/upload",
          storageKey: "key",
        }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ documento: DOCUMENTO }),
      } as Response);

    const { Wrapper } = criarWrapper();
    const { result } = renderHook(() => useEnviarDocumento("caso", "caso-1"), {
      wrapper: Wrapper,
    });

    result.current.mutate(arquivo);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const chamadas = (global.fetch as jest.Mock).mock.calls;
    expect(JSON.parse(chamadas[0][1].body)).toMatchObject({ tamanhoBytes: 84887 });
    expect(JSON.parse(chamadas[2][1].body)).toMatchObject({ tamanhoBytes: 84887 });
  });

  it("rejeita antes de chamar a API quando o arquivo não tem tipo suportado", async () => {
    const arquivo = new File(["conteudo"], "virus.exe", { type: "application/octet-stream" });
    const { Wrapper } = criarWrapper();
    const { result } = renderHook(() => useEnviarDocumento("caso", "caso-1"), {
      wrapper: Wrapper,
    });

    result.current.mutate(arquivo);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("propaga erro quando o PUT no S3 falha", async () => {
    const arquivo = new File(["conteudo"], "contrato.pdf", { type: "application/pdf" });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          documentoId: "doc-1",
          uploadUrl: "https://s3.example.com/upload",
          storageKey: "key",
        }),
      } as Response)
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response);

    const { Wrapper } = criarWrapper();
    const { result } = renderHook(() => useEnviarDocumento("caso", "caso-1"), {
      wrapper: Wrapper,
    });

    result.current.mutate(arquivo);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe("useExcluirDocumento", () => {
  it("envia DELETE para /api/documentos/[id] e invalida a lista", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as Response);

    const { Wrapper, queryClient } = criarWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useExcluirDocumento("caso", "caso-1"), {
      wrapper: Wrapper,
    });

    result.current.mutate("doc-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/documentos/doc-1");
    expect(init.method).toBe("DELETE");
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: chaveDocumentos("caso", "caso-1"),
    });
  });
});

describe("useRenomearDocumento", () => {
  it("envia PATCH para /api/documentos/[id] com o novo nome e invalida a lista", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ documento: { ...DOCUMENTO, nomeOriginal: "novo-nome.pdf" } }),
    } as Response);

    const { Wrapper, queryClient } = criarWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useRenomearDocumento("caso", "caso-1"), {
      wrapper: Wrapper,
    });

    result.current.mutate({ id: "doc-1", nomeArquivo: "novo-nome.pdf" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/documentos/doc-1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ nomeArquivo: "novo-nome.pdf" });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: chaveDocumentos("caso", "caso-1"),
    });
  });
});
