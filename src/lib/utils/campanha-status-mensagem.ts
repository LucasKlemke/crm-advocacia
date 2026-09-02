// Status de uma mensagem dentro da campanha, do ponto de vista de quem acompanha o envio.
// O /sender/listmessages tipa `status` só como string (o filtro documenta Scheduled, Sent
// e Failed), então tudo aqui é normalização defensiva.
export type StatusMensagem =
  | "pendente"
  | "enviada"
  | "entregue"
  | "lida"
  | "falha"
  | "desconhecido";

const STATUS_POR_UAZAPI: Record<string, StatusMensagem> = {
  scheduled: "pendente",
  pending: "pendente",
  queued: "pendente",
  sent: "enviada",
  server_ack: "enviada",
  delivered: "entregue",
  delivery_ack: "entregue",
  read: "lida",
  played: "lida",
  failed: "falha",
  error: "falha",
};

// Diferente de paraStatusCampanha (que alimenta um enum do Prisma e precisa recusar valor
// fora do contrato), aqui o status é só exibido: um valor novo vira "desconhecido" em vez
// de derrubar a consulta inteira.
export function paraStatusMensagem(bruto: string): StatusMensagem {
  return STATUS_POR_UAZAPI[bruto.trim().toLowerCase()] ?? "desconhecido";
}

// O chatid chega como jid do WhatsApp ("5511999998888@s.whatsapp.net"). O que interessa é
// o número em dígitos, que é a chave para casar com o campanha_item gravado no envio.
export function numeroDoChatid(chatid: string): string {
  return chatid.split("@")[0].replace(/\D/g, "");
}

// Timestamp do WhatsApp vem em segundos; a doc não garante isso, então valor grande é
// aceito como milissegundos. O corte fica bem acima de qualquer data plausível em segundos
// (1e12 s ≈ ano 33658) e bem abaixo de qualquer data plausível em ms (1e12 ms ≈ 2001).
const LIMITE_SEGUNDOS = 1e12;

export function paraDataMensagem(timestamp: number): Date | null {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  return new Date(timestamp < LIMITE_SEGUNDOS ? timestamp * 1000 : timestamp);
}

// Da mais grave para a menos grave. Guia o desempate quando o mesmo número recebeu várias
// mensagens na campanha: esconder uma falha atrás de um "lida" seria o pior resultado.
const GRAVIDADE: StatusMensagem[] = [
  "falha",
  "desconhecido",
  "pendente",
  "enviada",
  "entregue",
  "lida",
];

export interface MensagemPorNumero {
  numero: string;
  status: StatusMensagem;
  erro: string | null;
}

export interface ResumoMensagem {
  status: StatusMensagem;
  erro: string | null;
  quantidade: number;
}

// Índice número → status, que é como a tabela de destinatários (vinda do banco) recebe o
// que a UAZAPI sabe de cada mensagem.
export function resumirPorNumero(
  mensagens: readonly MensagemPorNumero[]
): Map<string, ResumoMensagem> {
  const resumo = new Map<string, ResumoMensagem>();

  for (const mensagem of mensagens) {
    if (!mensagem.numero) continue;

    const atual = resumo.get(mensagem.numero);
    if (!atual) {
      resumo.set(mensagem.numero, {
        status: mensagem.status,
        erro: mensagem.erro,
        quantidade: 1,
      });
      continue;
    }

    const vence = GRAVIDADE.indexOf(mensagem.status) < GRAVIDADE.indexOf(atual.status);
    resumo.set(mensagem.numero, {
      status: vence ? mensagem.status : atual.status,
      erro: vence ? mensagem.erro : atual.erro,
      quantidade: atual.quantidade + 1,
    });
  }

  return resumo;
}
