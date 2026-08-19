// DTOs trafegados entre as rotas /api e o client. Datas chegam como string (JSON),
// por isso não dá para reusar os tipos do Prisma direto no componente.
export interface ClienteDTO {
  id: string;
  nome: string;
  cpf: string;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  softDeletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListaClientes {
  clientes: ClienteDTO[];
  total: number;
  pagina: number;
  porPagina: number;
}

export interface FiltrosClientes {
  busca: string;
  incluirExcluidos: boolean;
  pagina: number;
}

export interface ComentarioDTO {
  id: string;
  conteudo: string;
  autorUsuarioId: string;
  editadoEm: string | null;
  createdAt: string;
  autor: { id: string; nome: string; email: string };
}

export type EscopoComentarioDTO = "cliente";
