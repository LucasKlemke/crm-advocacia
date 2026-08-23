// DTOs trafegados entre as rotas /api/tipos-processo e o client. Datas chegam como
// string (JSON), por isso não dá para reusar os tipos do Prisma direto no componente.
export interface TipoProcessoDTO {
  id: string;
  escritorioId: string;
  nome: string;
  icone: string;
  cor: string;
  descricao: string | null;
  ordem: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListaTiposProcesso {
  tipos: TipoProcessoDTO[];
}
