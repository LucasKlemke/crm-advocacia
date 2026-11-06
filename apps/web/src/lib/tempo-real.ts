import type { CampanhaDTO } from "@crm/compartilhado/tipos/campanha";
import { ApiError, apiFetch, ehSessaoExpirada } from "@/lib/api-client";

// Conexão com o WebSocket /api/ws da API (contrato em apps/api/src/tempo-real/servidor-ws.ts).
// O socket é só um atalho: sem ele a tela continua funcionando com o botão Sincronizar.

export type EstadoTempoReal = "conectado" | "conectando" | "indisponivel";

export type MensagemTempoReal =
  | { tipo: "pronto" }
  | { tipo: "campanha.atualizada"; campanha: CampanhaDTO }
  | { tipo: "campanha.removida"; campanhaId: string };

const RECONEXAO_INICIAL_MS = 1000;
const RECONEXAO_MAXIMA_MS = 30_000;

// 4403: a origem da página não está em WEB_ORIGINS — tentar de novo dá no mesmo.
// 4429: esta aba foi a conexão mais antiga e saiu para dar lugar a uma nova (limite de 5
// por usuário); reconectar derrubaria outra aba, que derrubaria esta, num ciclo sem fim.
// Os demais (4401 ticket recusado, 1011 erro ao resolver o tenant, queda de rede) se
// resolvem tentando de novo com ticket novo.
const FECHAMENTOS_DEFINITIVOS = new Set([4403, 4429]);

// Respostas do pedido de ticket que encerram as tentativas: 403 (sem permissão) e 404 (desligado).
const STATUS_DEFINITIVOS = new Set([403, 404]);

/** URL do WebSocket: `base` (VITE_WS_URL) quando a API mora em outra origem; senão a da página. */
export function montarUrlWs(
  ticket: string,
  base: string | undefined,
  localizacao: Location,
): string {
  const query = `/api/ws?ticket=${encodeURIComponent(ticket)}`;
  if (base) return `${base.replace(/\/+$/, "")}${query}`;
  const protocolo = localizacao.protocol === "https:" ? "wss:" : "ws:";
  return `${protocolo}//${localizacao.host}${query}`;
}

/** Espera antes da tentativa `n` (0-based): 1 s, 2 s, 4 s… até 30 s. */
export function atrasoReconexao(tentativa: number): number {
  return Math.min(RECONEXAO_INICIAL_MS * 2 ** tentativa, RECONEXAO_MAXIMA_MS);
}

/** Lê uma mensagem do servidor; qualquer coisa fora do contrato vira null e é ignorada. */
export function interpretarMensagem(dados: unknown): MensagemTempoReal | null {
  if (typeof dados !== "string") return null;
  let valor: unknown;
  try {
    valor = JSON.parse(dados);
  } catch {
    return null;
  }
  if (!valor || typeof valor !== "object") return null;
  const mensagem = valor as Record<string, unknown>;
  switch (mensagem.tipo) {
    case "pronto":
      return { tipo: "pronto" };
    case "campanha.atualizada":
      return mensagem.campanha && typeof mensagem.campanha === "object"
        ? {
            tipo: "campanha.atualizada",
            campanha: mensagem.campanha as CampanhaDTO,
          }
        : null;
    case "campanha.removida":
      return typeof mensagem.campanhaId === "string"
        ? { tipo: "campanha.removida", campanhaId: mensagem.campanhaId }
        : null;
    default:
      return null;
  }
}

export interface OpcoesConexaoTempoReal {
  base: string | undefined;
  aoMudarEstado: (estado: EstadoTempoReal) => void;
  aoMensagem: (
    mensagem: Exclude<MensagemTempoReal, { tipo: "pronto" }>,
  ) => void;
}

/**
 * Abre e mantém a conexão: ticket → socket → ("pronto") conectado. Toda reconexão pede
 * ticket novo, porque o ticket é de uso único e vale 60 s.
 */
export function conectarTempoReal(opcoes: OpcoesConexaoTempoReal): {
  fechar: () => void;
} {
  let encerrado = false;
  let tentativa = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let socket: WebSocket | null = null;

  function desistir() {
    encerrado = true;
    opcoes.aoMudarEstado("indisponivel");
  }

  function agendarReconexao() {
    opcoes.aoMudarEstado("conectando");
    timer = setTimeout(() => void abrir(), atrasoReconexao(tentativa));
    tentativa += 1;
  }

  async function abrir() {
    timer = undefined;
    let ticket: string;
    try {
      ({ ticket } = await apiFetch<{ ticket: string }>(
        "/api/tempo-real/ticket",
      ));
    } catch (erro) {
      if (encerrado) return;
      // 404: tempo real desligado no servidor (TEMPO_REAL_HABILITADO=false). 403: sessão sem
      // permissão para o ticket. Sessão expirada: o apiFetch já está levando ao login. Em
      // nenhum dos três insistir ajuda.
      if (
        ehSessaoExpirada(erro) ||
        (erro instanceof ApiError && STATUS_DEFINITIVOS.has(erro.status))
      ) {
        desistir();
        return;
      }
      agendarReconexao();
      return;
    }
    if (encerrado) return;

    const ws = new WebSocket(montarUrlWs(ticket, opcoes.base, window.location));
    socket = ws;
    ws.onmessage = (evento) => {
      const mensagem = interpretarMensagem(evento.data);
      if (!mensagem) return;
      if (mensagem.tipo === "pronto") {
        tentativa = 0;
        opcoes.aoMudarEstado("conectado");
        return;
      }
      opcoes.aoMensagem(mensagem);
    };
    // Erro de socket sempre termina num close: a decisão de reconectar fica toda aqui.
    ws.onclose = (evento) => {
      if (socket !== ws || encerrado) return;
      socket = null;
      if (FECHAMENTOS_DEFINITIVOS.has(evento.code)) {
        desistir();
        return;
      }
      agendarReconexao();
    };
  }

  opcoes.aoMudarEstado("conectando");
  void abrir();

  return {
    fechar() {
      encerrado = true;
      if (timer) clearTimeout(timer);
      const atual = socket;
      socket = null;
      atual?.close(1000);
    },
  };
}
