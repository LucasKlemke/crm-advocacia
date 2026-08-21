// DTO público de documento (RN17/RN18/RN19) — espelha DocumentoPublico
// (src/lib/documentos/publico.ts), sem storageKey/autorMembroId.
export type EscopoDocumentoDTO = "cliente" | "caso";

export type TipoArquivoDTO = "pdf" | "docx" | "jpg" | "jpeg" | "png";

export interface DocumentoDTO {
  id: string;
  escopo: EscopoDocumentoDTO;
  escopoId: string;
  nomeOriginal: string;
  tipoArquivo: TipoArquivoDTO;
  tamanhoKb: number;
  createdAt: string;
}
