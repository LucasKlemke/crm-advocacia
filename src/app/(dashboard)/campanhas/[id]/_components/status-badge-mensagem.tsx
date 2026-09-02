import { BadgeStatus } from "@/components/shared/badge-status";
import type { StatusMensagem } from "@/lib/utils/campanha-status-mensagem";

// Cor fixa por status da mensagem na UAZAPI — não é dado do tenant, mesma técnica do
// status-badge-campanha. A escala segue o caminho da mensagem: cinza esperando, azul saiu,
// verde chegou/foi lida, vermelho falhou.
const CONFIG_STATUS: Record<StatusMensagem, { label: string; cor: string }> = {
  pendente: { label: "Pendente", cor: "#6b7280" },
  enviada: { label: "Enviada", cor: "#3b82f6" },
  entregue: { label: "Entregue", cor: "#14b8a6" },
  lida: { label: "Lida", cor: "#22c55e" },
  falha: { label: "Falha", cor: "#ef4444" },
  desconhecido: { label: "Desconhecido", cor: "#a1a1aa" },
};

export interface StatusBadgeMensagemProps {
  status: StatusMensagem;
}

export function StatusBadgeMensagem({ status }: StatusBadgeMensagemProps) {
  const config = CONFIG_STATUS[status];
  return <BadgeStatus nome={config.label} cor={config.cor} />;
}
