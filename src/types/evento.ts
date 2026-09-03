// DTOs trafegados entre as rotas /api/eventos e o client. Datas chegam sempre como
// string ISO em UTC (JSON) — a conversão para o fuso local é responsabilidade da UI,
// nunca do servidor, para o mesmo evento render igual em qualquer máquina.

export type ModalidadeEvento = "presencial" | "online";

// As três visões do calendário. Vive aqui (e não só na UI) porque a rota usa a mesma
// nomenclatura no query param `?visao=`.
export type VisaoAgenda = "mes" | "semana" | "dia";

export interface EventoUsuarioDTO {
  id: string;
  nome: string;
  email: string;
  avatarUrl: string | null;
}

// Participante e criador são identificados pelo membro (o vínculo com o escritório),
// mas exibidos pelo usuário — a UI precisa dos dois lados.
export interface EventoMembroDTO {
  membroId: string;
  usuario: EventoUsuarioDTO;
}

export interface EventoClienteDTO {
  id: string;
  nome: string;
  cpf: string;
}

export interface EventoCasoDTO {
  id: string;
  numeroProcesso: string | null;
  cliente: { id: string; nome: string };
  tipoProcesso: { id: string; nome: string; cor: string; icone: string };
}

export interface EventoDTO {
  id: string;
  escritorioId: string;
  titulo: string;
  descricao: string | null;
  inicio: string;
  fim: string;
  diaInteiro: boolean;
  modalidade: ModalidadeEvento;
  local: string | null;
  linkReuniao: string | null;
  clienteId: string | null;
  casoId: string | null;
  criadoPorMembroId: string;
  createdAt: string;
  updatedAt: string;
  cliente: EventoClienteDTO | null;
  caso: EventoCasoDTO | null;
  criadoPor: EventoMembroDTO;
  participantes: EventoMembroDTO[];
  // Calculado por evento a cada resposta (RN34): a UI não recalcula permissão.
  podeEditar: boolean;
}

export interface ListaEventos {
  eventos: EventoDTO[];
}

// Período pedido pela agenda — sempre um intervalo fechado, derivado da visão ativa.
export interface FiltrosEventos {
  inicio: string;
  fim: string;
}

// Estado do formulário de evento na UI. Datas como valor de <input datetime-local>
// (hora local, sem timezone) — convertidas na submissão.
export interface DadosEventoForm {
  titulo: string;
  descricao: string;
  inicio: string;
  fim: string;
  diaInteiro: boolean;
  modalidade: ModalidadeEvento;
  local: string;
  linkReuniao: string;
  vinculo: { tipo: "nenhum" } | { tipo: "caso"; id: string } | { tipo: "cliente"; id: string };
  participanteMembroIds: string[];
}
