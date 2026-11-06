import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import {
  AcessoNegadoError,
  NaoAutenticadoError,
  SemEscritorioAtivoError,
  resolverTenantContext,
  type SessaoMinima,
  type TenantContext,
} from "@dominio/lib/auth/resolver-tenant";
import { DURACAO_TICKET_WS_SEGUNDOS, verificarTicketWs } from "@dominio/lib/auth/sessao-jwt";
import { eventosCampanha, type EventoCampanha } from "@dominio/lib/tempo-real/eventos-campanha";

// Servidor WebSocket de /api/ws: entrega o progresso das campanhas ao escritório da
// sessão. Não é uma rota Nest — anexa-se ao `upgrade` do http.Server da API (main.ts).
//
// Contrato servidor → cliente (JSON):
//   { tipo: "pronto" }                                       — autenticado e assinado
//   { tipo: "campanha.atualizada", campanha: CampanhaDTO }
//   { tipo: "campanha.removida", campanhaId: string }
// Códigos de fechamento: 4401 (ticket ausente/inválido/expirado/reusado ou sem acesso ao
// escritório), 4403 (Origin proibida), 4429 (substituída: o usuário abriu uma 6ª conexão),
// 1011 (erro interno ao resolver o tenant).

export const CAMINHO_WS = "/api/ws";
export const CODIGO_NAO_AUTENTICADO = 4401;
export const CODIGO_ORIGEM_PROIBIDA = 4403;
export const CODIGO_LIMITE_CONEXOES = 4429;
const CODIGO_ERRO_INTERNO = 1011;
const CODIGO_DESLIGANDO = 1001;
const PRAZO_FECHAMENTO_MS = 1000;
export const INTERVALO_PING_MS = 25000;
export const MAX_CONEXOES_POR_USUARIO = 5;
// A cada 4 ciclos de ping (~100 s) o vínculo do socket é conferido de novo no banco: um
// membro removido do escritório não continua recebendo eventos até fechar a aba (RN19).
export const CICLOS_REVALIDACAO = 4;

export interface OpcoesServidorWs {
  // Origens da SPA aceitas além da própria origem da API (WEB_ORIGINS).
  origensWeb: string[];
  // Injetáveis para teste; em produção valem os padrões.
  resolverTenant?: (sessao: SessaoMinima) => Promise<TenantContext>;
  intervaloPingMs?: number;
}

export interface ServidorWs {
  fechar(): Promise<void>;
}

interface Conexao {
  socket: WebSocket;
  usuarioId: string;
  escritorioId: string;
  vivo: boolean;
  revalidando: boolean;
  cancelar: () => void;
}

type MensagemWs =
  | { tipo: "pronto" }
  | { tipo: "campanha.atualizada"; campanha: unknown }
  | { tipo: "campanha.removida"; campanhaId: string };

// O payload que vai ao browser nunca leva o escritorioId: o socket já é de um escritório só.
function paraCliente(evento: EventoCampanha): MensagemWs {
  return evento.tipo === "campanha.atualizada"
    ? { tipo: "campanha.atualizada", campanha: evento.campanha }
    : { tipo: "campanha.removida", campanhaId: evento.campanhaId };
}

function enviar(socket: WebSocket, mensagem: MensagemWs): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(mensagem));
}

function erroDeAutenticacao(erro: unknown): boolean {
  return (
    erro instanceof NaoAutenticadoError ||
    erro instanceof SemEscritorioAtivoError ||
    erro instanceof AcessoNegadoError
  );
}

// Origin ausente = cliente não-browser (o Origin só protege contra páginas de terceiros
// usando o browser da vítima). Presente: precisa estar em WEB_ORIGINS ou ser a própria API.
function origemPermitida(req: IncomingMessage, origensWeb: string[]): boolean {
  const origem = req.headers.origin;
  if (origem === undefined) return true;
  if (origensWeb.includes(origem)) return true;
  try {
    return new URL(origem).host === req.headers.host;
  } catch {
    return false;
  }
}

// Registro dos jti já usados: o ticket é de uso único. Cada entrada vive até o ticket
// expirar — depois disso o próprio JWT já é recusado, então pode sair da memória.
function criarRegistroJti() {
  const usados = new Map<string, number>();
  return {
    consumir(jti: string): boolean {
      const agora = Date.now();
      for (const [chave, expiraEm] of usados) {
        if (expiraEm <= agora) usados.delete(chave);
      }
      if (usados.has(jti)) return false;
      // Margem de 1 s para o arredondamento do exp em segundos.
      usados.set(jti, agora + (DURACAO_TICKET_WS_SEGUNDOS + 1) * 1000);
      return true;
    },
  };
}

export function anexarServidorWs(servidor: Server, opcoes: OpcoesServidorWs): ServidorWs {
  const resolverTenant = opcoes.resolverTenant ?? resolverTenantContext;
  const wss = new WebSocketServer({ noServer: true });
  const registroJti = criarRegistroJti();
  // Conexões autenticadas por usuário, da mais antiga para a mais nova.
  const conexoesPorUsuario = new Map<string, Conexao[]>();

  function remover(conexao: Conexao): void {
    conexao.cancelar();
    const lista = conexoesPorUsuario.get(conexao.usuarioId);
    if (!lista) return;
    const restantes = lista.filter((c) => c !== conexao);
    if (restantes.length > 0) conexoesPorUsuario.set(conexao.usuarioId, restantes);
    else conexoesPorUsuario.delete(conexao.usuarioId);
  }

  function registrar(socket: WebSocket, ctx: TenantContext): void {
    // O socket fica preso ao escritório do ticket (RN19): mesmo que o usuário seja membro
    // de outros, só recebe eventos deste.
    const conexao: Conexao = {
      socket,
      usuarioId: ctx.usuarioId,
      escritorioId: ctx.escritorioId,
      vivo: true,
      revalidando: false,
      cancelar: eventosCampanha.assinar(ctx.escritorioId, (evento) => enviar(socket, paraCliente(evento))),
    };
    socket.on("pong", () => {
      conexao.vivo = true;
    });
    socket.once("close", () => remover(conexao));

    const lista = conexoesPorUsuario.get(ctx.usuarioId) ?? [];
    lista.push(conexao);
    conexoesPorUsuario.set(ctx.usuarioId, lista);
    while (lista.length > MAX_CONEXOES_POR_USUARIO) {
      const antiga = lista.shift()!;
      antiga.cancelar();
      antiga.socket.close(CODIGO_LIMITE_CONEXOES, "Limite de conexões");
    }

    enviar(socket, { tipo: "pronto" });
  }

  async function autenticar(socket: WebSocket, req: IncomingMessage): Promise<void> {
    if (!origemPermitida(req, opcoes.origensWeb)) {
      socket.close(CODIGO_ORIGEM_PROIBIDA, "Origem proibida");
      return;
    }

    const ticket = new URL(req.url ?? "", "http://localhost").searchParams.get("ticket");
    const dados = await verificarTicketWs(ticket);
    if (!dados || !registroJti.consumir(dados.jti)) {
      socket.close(CODIGO_NAO_AUTENTICADO, "Não autenticado");
      return;
    }

    let ctx: TenantContext;
    try {
      // Membership e escritório conferidos no banco, como no TenantGuard (RN19).
      ctx = await resolverTenant({ usuarioId: dados.sub, escritorioId: dados.escritorioId });
    } catch (erro) {
      if (erroDeAutenticacao(erro)) {
        socket.close(CODIGO_NAO_AUTENTICADO, "Não autenticado");
      } else {
        console.error("[tempo-real] falha ao resolver o tenant do WebSocket", erro);
        socket.close(CODIGO_ERRO_INTERNO, "Erro interno");
      }
      return;
    }

    // O cliente pode ter desistido enquanto o banco respondia.
    if (socket.readyState !== socket.OPEN) return;
    registrar(socket, ctx);
  }

  function aoUpgrade(req: IncomingMessage, socket: Duplex, cabeca: Buffer): void {
    const { pathname } = new URL(req.url ?? "", "http://localhost");
    if (pathname !== CAMINHO_WS) {
      socket.destroy();
      return;
    }
    // O handshake completa sempre: 4401/4403 são códigos de fechamento do WebSocket, que o
    // browser só enxerga depois do upgrade (uma resposta HTTP de erro vira só "1006").
    wss.handleUpgrade(req, socket, cabeca, (ws) => {
      // Só o código: a mensagem e o contexto podem carregar a URL com o ticket.
      ws.on("error", (erro: Error & { code?: string }) => {
        console.warn("[tempo-real] erro no WebSocket", { codigo: erro.code });
      });
      autenticar(ws, req).catch((erro) => {
        console.error("[tempo-real] falha ao autenticar o WebSocket", erro);
        ws.close(CODIGO_ERRO_INTERNO, "Erro interno");
      });
    });
  }

  servidor.on("upgrade", aoUpgrade);

  // Batimento: a cada intervalo, quem não respondeu ao ping anterior é derrubado (conexão
  // meio-aberta atrás de proxy/NAT) e os demais recebem novo ping.
  // Membership sumiu → 4401 (o cliente pede ticket novo e falha na emissão). Erro
  // transitório (banco fora) mantém o socket: loga e tenta no próximo ciclo.
  async function revalidar(conexao: Conexao): Promise<void> {
    if (conexao.revalidando) return;
    conexao.revalidando = true;
    const ids = { usuarioId: conexao.usuarioId, escritorioId: conexao.escritorioId };
    try {
      await resolverTenant(ids);
    } catch (erro) {
      if (erroDeAutenticacao(erro)) {
        conexao.cancelar();
        conexao.socket.close(CODIGO_NAO_AUTENTICADO, "Não autenticado");
      } else {
        console.error("[tempo-real] falha ao revalidar o vínculo do WebSocket", ids, erro);
      }
    } finally {
      conexao.revalidando = false;
    }
  }

  let ciclo = 0;
  const batimento = setInterval(() => {
    ciclo += 1;
    const revalidarAgora = ciclo % CICLOS_REVALIDACAO === 0;
    for (const lista of conexoesPorUsuario.values()) {
      for (const conexao of lista) {
        if (!conexao.vivo) {
          conexao.socket.terminate();
          continue;
        }
        conexao.vivo = false;
        conexao.socket.ping();
        if (revalidarAgora) void revalidar(conexao);
      }
    }
  }, opcoes.intervaloPingMs ?? INTERVALO_PING_MS);
  batimento.unref();

  return {
    async fechar() {
      clearInterval(batimento);
      servidor.off("upgrade", aoUpgrade);
      for (const lista of [...conexoesPorUsuario.values()]) {
        for (const conexao of lista) remover(conexao);
      }
      // Com noServer o wss.close() não fecha os clientes: cada um é encerrado aqui. Close
      // limpo primeiro (o browser reconecta em outra task); quem não completar o handshake
      // de fechamento a tempo é derrubado, para não segurar o desligamento do http.Server.
      const abertos = [...wss.clients];
      await Promise.all(
        abertos.map(
          (socket) =>
            new Promise<void>((resolve) => {
              const limite = setTimeout(() => socket.terminate(), PRAZO_FECHAMENTO_MS);
              socket.once("close", () => {
                clearTimeout(limite);
                resolve();
              });
              socket.close(CODIGO_DESLIGANDO, "Servidor desligando");
            })
        )
      );
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    },
  };
}
