import type { StatusCampanha, StatusInstanciaWhatsapp } from "@prisma/client";
import type { StatusMensagem } from "@/lib/utils/campanha-status-mensagem";

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
  // Json cru do banco: campanhas criadas antes dos tratamentos guardaram
  // { variavel: "Coluna" }. Use normalizarMapeamento() antes de ler.
  mapeamentoVariaveis: unknown;
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

// Status de uma mensagem individual, consultado ao vivo na UAZAPI (/sender/listmessages).
// Não tem correspondente no banco: `numero` é a chave para casar com o CampanhaItemDTO.
export interface MensagemCampanhaDTO {
  numero: string;
  status: StatusMensagem;
  erro: string | null;
  enviadaEm: string | null;
}

export interface RespostaMensagensCampanha {
  mensagens: MensagemCampanhaDTO[];
  total: number;
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
