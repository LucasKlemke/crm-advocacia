// DTOs trafegados entre as rotas /api e o client. Datas chegam como string (JSON),
// por isso não dá para reusar os tipos do Prisma direto no componente.
export type SexoClienteDTO = "masculino" | "feminino" | "outro";

export type EstadoCivilClienteDTO =
  | "solteiro"
  | "casado"
  | "divorciado"
  | "viuvo"
  | "uniao_estavel";

export interface ClienteDTO {
  id: string;
  nome: string;
  cpf: string;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  sexo: SexoClienteDTO | null;
  estadoCivil: EstadoCivilClienteDTO | null;
  nomeMae: string | null;
  nomePai: string | null;
  nacionalidade: string | null;
  nascimento: string | null;
  profissao: string | null;
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

// Comentário deixou de ser exclusivo de cliente (RN21): os tipos vivem em
// @/types/comentario, reexportados aqui para não quebrar quem já importa daqui.
export type { ComentarioDTO, EscopoComentarioDTO } from "@/types/comentario";
