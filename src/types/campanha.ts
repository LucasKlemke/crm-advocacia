import type { StatusCampanha, StatusInstanciaWhatsapp } from "@prisma/client";

// DTOs trafegados entre as rotas /api/campanhas e o client. Datas chegam como string
// (JSON), por isso não dá para reusar os tipos do Prisma direto no componente. A
// instância vem reduzida a id/nome/status — o uazapiToken nunca sai do servidor.
export interface CampanhaDTO {
  id: string;
  escritorioId: string;
  instanciaWhatsappId: string | null;
  criadoPorId: string;
  nome: string;
  mensagemTemplate: string;
  mapeamentoVariaveis: Record<string, string> | null;
  colunaNumero: string;
  arquivoCsvNome: string | null;
  delayMin: number;
  delayMax: number;
  agendadaPara: string | null;
  status: StatusCampanha;
  uazapiFolderId: string;
  totalDestinatarios: number;
  logTotal: number;
  logSucesso: number;
  logFalha: number;
  logEntregue: number;
  logLido: number;
  logReproduzido: number;
  sincronizadoEm: string | null;
  createdAt: string;
  updatedAt: string;
  instancia: { id: string; nome: string; status: StatusInstanciaWhatsapp } | null;
}

export interface CampanhaItemDTO {
  id: string;
  campanhaId: string;
  linha: number;
  numero: string;
  mensagem: string;
  variaveis: Record<string, string> | null;
  createdAt: string;
}

export interface ListaCampanhas {
  campanhas: CampanhaDTO[];
}

export interface RespostaCampanha {
  campanha: CampanhaDTO;
}

export interface RespostaItensCampanha {
  itens: CampanhaItemDTO[];
  total: number;
  pagina: number;
  porPagina: number;
}

// `campanha: null` quando a ação foi "delete": a linha deixou de existir localmente.
export interface RespostaControleCampanha {
  campanha: CampanhaDTO | null;
}

export type AcaoCampanha = "stop" | "continue" | "delete";
