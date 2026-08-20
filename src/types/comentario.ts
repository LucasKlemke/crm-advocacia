// DTOs do sistema de comentários (RN21). Cresce junto com o domínio — hoje ancora em
// cliente e caso — sem precisar de uma tabela de comentários por entidade.
export type EscopoComentarioDTO = "cliente" | "caso";

export interface ComentarioDTO {
  id: string;
  conteudo: string;
  autorUsuarioId: string;
  editadoEm: string | null;
  createdAt: string;
  autor: { id: string; nome: string; email: string };
}
