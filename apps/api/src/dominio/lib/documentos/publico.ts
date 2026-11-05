import type { Documento, EscopoDocumento, TipoArquivo } from "@prisma/client";

export interface DocumentoPublico {
  id: string;
  escopo: EscopoDocumento;
  escopoId: string;
  nomeOriginal: string;
  tipoArquivo: TipoArquivo;
  tamanhoKb: number;
  createdAt: Date;
}

// `storage_key` e `autor_membro_id` são detalhes internos de persistência: a key expõe o
// layout do bucket (e o escritorio_id de quem a leu) e o membro autor não é usado por
// nenhuma tela. Toda resposta HTTP de documento passa por aqui para não vazá-los.
export function documentoParaPublico(documento: Documento): DocumentoPublico {
  return {
    id: documento.id,
    escopo: documento.escopo,
    escopoId: documento.escopoId,
    nomeOriginal: documento.nomeOriginal,
    tipoArquivo: documento.tipoArquivo,
    tamanhoKb: documento.tamanhoKb,
    createdAt: documento.createdAt,
  };
}
