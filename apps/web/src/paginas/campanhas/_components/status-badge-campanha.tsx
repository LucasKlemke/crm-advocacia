import { BadgeStatus } from "@/components/shared/badge-status";
import type { StatusCampanha } from "@prisma/client";

// Cor fixa por status do envio na UAZAPI — não é dado do tenant (diferente do status do
// kanban), então mora aqui como mapa fixo, mesma técnica de status-badge-instancia.
const CONFIG_STATUS: Record<StatusCampanha, { label: string; cor: string }> = {
  agendada: { label: "Agendada", cor: "#3b82f6" },
  enviando: { label: "Enviando", cor: "#f59e0b" },
  pausada: { label: "Pausada", cor: "#6b7280" },
  concluida: { label: "Concluída", cor: "#22c55e" },
  excluindo: { label: "Excluindo", cor: "#ef4444" },
};

export interface StatusBadgeCampanhaProps {
  status: StatusCampanha;
}

export function StatusBadgeCampanha({ status }: StatusBadgeCampanhaProps) {
  const config = CONFIG_STATUS[status];
  return <BadgeStatus nome={config.label} cor={config.cor} />;
}
