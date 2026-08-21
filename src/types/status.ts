// DTOs trafegados entre as rotas /api e o client. Datas chegam como string (JSON),
// por isso não dá para reusar os tipos do Prisma direto no componente.
export interface StatusDTO {
  id: string;
  escritorioId: string;
  tipoStatusId: string;
  nome: string;
  icone: string;
  cor: string;
  descricao: string | null;
  ordem: number;
  createdAt: string;
  updatedAt: string;
}

export interface TipoStatusDTO {
  id: string;
  chave: string;
  nome: string;
  icone: string;
  cor: string;
  descricao: string | null;
  ordem: number;
}

export interface ListaStatus {
  status: StatusDTO[];
}

export interface ListaTiposStatus {
  tipos: TipoStatusDTO[];
}
