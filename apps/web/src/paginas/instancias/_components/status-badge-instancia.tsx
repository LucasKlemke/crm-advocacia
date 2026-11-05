import { BadgeStatus } from "@/components/shared/badge-status";
import type { StatusInstanciaWhatsapp } from "@prisma/client";

// Cor fixa por status da conexão UAZAPI — diferente do status do kanban, não é dado do
// tenant, então mora aqui como mapa fixo. Mesma técnica de
// components/shared/documentos-grupo.tsx (CONFIG_TIPO_ARQUIVO): cor fixa por tipo, sem
// classe Tailwind literal, reaproveitando o pill com bolinha de BadgeStatus.
const CONFIG_STATUS: Record<StatusInstanciaWhatsapp, { label: string; cor: string }> = {
  disconnected: { label: "Desconectado", cor: "#ef4444" },
  connecting: { label: "Conectando", cor: "#f59e0b" },
  connected: { label: "Conectado", cor: "#22c55e" },
  hibernated: { label: "Hibernado", cor: "#6b7280" },
};

export interface StatusBadgeInstanciaProps {
  status: StatusInstanciaWhatsapp;
}

export function StatusBadgeInstancia({ status }: StatusBadgeInstanciaProps) {
  const config = CONFIG_STATUS[status];
  return <BadgeStatus nome={config.label} cor={config.cor} />;
}
