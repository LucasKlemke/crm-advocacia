import type { StatusCampanha } from "@crm/compartilhado/enums";
import type { StatusMensagem } from "@crm/compartilhado/utils/campanha-status-mensagem";

export const INTERVALO_ACOMPANHAMENTO_MS = 5000;
// Depois de concluída, a UAZAPI ainda pode demorar para gravar o status de cada mensagem
// e pode não mandar outro webhook: a tela relê sozinha por um tempo limitado.
const JANELA_DEPOIS_DE_CONCLUIDA_MS = 10 * 60_000;

// Rede de segurança do tempo real: enquanto a campanha anda, ou terminou há pouco com
// destinatário sem status final, a tabela relê o /mensagens a cada 5 s. Linha sem
// status (`undefined`) conta como pendente: a UAZAPI ainda não devolveu a mensagem dela.
export function deveAcompanharMensagens(
  campanha: { status: StatusCampanha; updatedAt: string },
  statusDasLinhas: readonly (StatusMensagem | undefined)[],
  agora: number
): boolean {
  if (campanha.status === "agendada" || campanha.status === "enviando") return true;
  if (campanha.status !== "concluida") return false;

  const recente = agora - Date.parse(campanha.updatedAt) < JANELA_DEPOIS_DE_CONCLUIDA_MS;
  return recente && statusDasLinhas.some((status) => status === undefined || status === "pendente");
}
