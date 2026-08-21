"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { inferirTipoArquivo } from "@/lib/utils/tipo-arquivo";
import type { DocumentoDTO, EscopoDocumentoDTO, TipoArquivoDTO } from "@/types/documento";

const MIME_POR_TIPO_ARQUIVO: Record<TipoArquivoDTO, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

export const chaveDocumentos = (escopo: EscopoDocumentoDTO, escopoId: string) =>
  ["documentos", escopo, escopoId] as const;

export function useDocumentos(escopo: EscopoDocumentoDTO, escopoId: string | null) {
  return useQuery({
    queryKey: chaveDocumentos(escopo, escopoId ?? ""),
    queryFn: () =>
      apiFetch<{ documentos: DocumentoDTO[] }>(
        `/api/documentos?escopo=${escopo}&escopoId=${escopoId}`
      ),
    enabled: Boolean(escopoId),
  });
}

function useInvalidarDocumentos(escopo: EscopoDocumentoDTO, escopoId: string | null) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: chaveDocumentos(escopo, escopoId ?? "") });
}

export class TipoArquivoNaoSuportadoError extends Error {
  constructor() {
    super("Tipo de arquivo não suportado. Aceitos: PDF, DOCX, JPG, JPEG, PNG.");
    this.name = "TipoArquivoNaoSuportadoError";
  }
}

// Upload em 3 passos (mesmo fluxo de avatar-upload.tsx): pede a URL assinada, envia o
// arquivo direto ao S3 (fetch cru — é uma URL externa, não passa por apiFetch) e só
// então confirma, criando a linha no banco.
export function useEnviarDocumento(escopo: EscopoDocumentoDTO, escopoId: string | null) {
  const invalidar = useInvalidarDocumentos(escopo, escopoId);
  return useMutation({
    mutationFn: async (arquivo: File): Promise<DocumentoDTO> => {
      const tipoArquivo = inferirTipoArquivo(arquivo.name);
      if (!tipoArquivo) {
        throw new TipoArquivoNaoSuportadoError();
      }
      // Bytes exatos, não KB arredondado: o Content-Length assinado na URL do S3 precisa
      // bater com o PUT real, senão a assinatura diverge e o S3 responde 403.
      const tamanhoBytes = arquivo.size;

      const { documentoId, uploadUrl } = await apiFetch<{
        documentoId: string;
        uploadUrl: string;
        storageKey: string;
      }>("/api/documentos/upload-url", {
        method: "POST",
        body: JSON.stringify({
          escopo,
          escopoId,
          nomeArquivo: arquivo.name,
          tipoArquivo,
          tamanhoBytes,
        }),
      });

      const respostaS3 = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": MIME_POR_TIPO_ARQUIVO[tipoArquivo] },
        body: arquivo,
      });
      if (!respostaS3.ok) {
        throw new Error("Não foi possível enviar o documento.");
      }

      const { documento } = await apiFetch<{ documento: DocumentoDTO }>(
        `/api/documentos/${documentoId}/confirmar`,
        {
          method: "POST",
          body: JSON.stringify({
            escopo,
            escopoId,
            nomeArquivo: arquivo.name,
            tipoArquivo,
            tamanhoBytes,
          }),
        }
      );
      return documento;
    },
    onSuccess: invalidar,
  });
}

export function useExcluirDocumento(escopo: EscopoDocumentoDTO, escopoId: string | null) {
  const invalidar = useInvalidarDocumentos(escopo, escopoId);
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: true }>(`/api/documentos/${id}`, { method: "DELETE" }),
    onSuccess: invalidar,
  });
}

export function useRenomearDocumento(escopo: EscopoDocumentoDTO, escopoId: string | null) {
  const invalidar = useInvalidarDocumentos(escopo, escopoId);
  return useMutation({
    mutationFn: ({ id, nomeArquivo }: { id: string; nomeArquivo: string }) =>
      apiFetch<{ documento: DocumentoDTO }>(`/api/documentos/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ nomeArquivo }),
      }),
    onSuccess: invalidar,
  });
}
