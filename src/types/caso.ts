// DTOs trafegados entre as rotas /api/casos e o client. Datas chegam como string
// (JSON); `valor` chega como string (Decimal serializado) ou número, nunca como
// instância de Decimal — por isso o tipo aceita `string | number | null`.
import type { StatusDTO } from "@/types/status";

export interface CasoClienteDTO {
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

export interface CasoResponsavelDTO {
  id: string;
  usuario: { id: string; nome: string; email: string };
}

export interface CasoDTO {
  id: string;
  escritorioId: string;
  clienteId: string;
  statusId: string;
  responsavelMembroId: string | null;
  titulo: string;
  numeroProcesso: string | null;
  descricao: string | null;
  valor: string | number | null;
  arquivado: boolean;
  createdAt: string;
  updatedAt: string;
  cliente: CasoClienteDTO;
  status: StatusDTO;
  responsavel: CasoResponsavelDTO | null;
}

export interface ListaCasos {
  casos: CasoDTO[];
  total: number;
  pagina: number;
  porPagina: number;
}

export interface ColunaKanban {
  status: StatusDTO;
  total: number;
  casos: CasoDTO[];
}

export interface KanbanCasos {
  colunas: ColunaKanban[];
}

export interface OpcaoFiltroCaso {
  id: string;
  nome: string;
}

export interface OpcaoClienteFiltro {
  id: string;
  nome: string;
  cpf: string;
}

export interface OpcaoStatusFiltro {
  id: string;
  nome: string;
  cor: string;
}

export interface OpcaoTipoStatusFiltro {
  id: string;
  nome: string;
  chave: string;
  cor: string;
}

export interface FiltrosCasoOpcoes {
  clientes: OpcaoClienteFiltro[];
  membros: OpcaoFiltroCaso[];
  status: OpcaoStatusFiltro[];
  tipos: OpcaoTipoStatusFiltro[];
}

export const SEM_RESPONSAVEL = "sem-responsavel";

// Estado dos filtros na UI (casos-view.tsx) — convertido para query string pelos hooks.
export interface FiltrosCasos {
  busca: string;
  statusIds: string[];
  tipoStatusIds: string[];
  clienteIds: string[];
  responsavelIds: string[];
  dataInicio: string | null;
  dataFim: string | null;
  arquivado: boolean;
  pagina: number;
}

export const filtrosCasosPadrao: FiltrosCasos = {
  busca: "",
  statusIds: [],
  tipoStatusIds: [],
  clienteIds: [],
  responsavelIds: [],
  dataInicio: null,
  dataFim: null,
  arquivado: false,
  pagina: 1,
};
