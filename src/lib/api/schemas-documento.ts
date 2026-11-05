import { z } from "zod";
import { nomeArquivoSchema } from "@/lib/api/schemas-comuns";

const escopoSchema = z.enum(["cliente", "caso"]);
const tipoArquivoSchema = z.enum(["pdf", "docx", "jpg", "png", "jpeg"]);

// GET /api/documentos?escopo=&escopoId= — ambos obrigatórios.
export const escopoDocumentoSchema = z.object({
  escopo: escopoSchema,
  escopoId: z.uuid(),
});

// Pedido de URL assinada de upload (RN17/RN18: tamanho e tipo são revalidados no service).
export const uploadDocumentoSchema = z.object({
  escopo: escopoSchema,
  escopoId: z.uuid(),
  nomeArquivo: nomeArquivoSchema,
  tipoArquivo: tipoArquivoSchema,
  tamanhoBytes: z.number().int().positive(),
});

// Sem `storageKey`: a key é derivada pelo service a partir do id da URL, nunca enviada
// pelo cliente (senão a linha poderia apontar para um objeto arbitrário do bucket). O
// Zod descarta a chave extra.
export const confirmarUploadDocumentoSchema = uploadDocumentoSchema;

export const renomearDocumentoSchema = z.object({
  nomeArquivo: nomeArquivoSchema,
});

export const modoDownloadSchema = z.object({ modo: z.enum(["anexo", "inline"]).optional() });
