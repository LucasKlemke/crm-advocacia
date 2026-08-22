import { Badge } from "@/components/ui/badge";

export interface BadgeStatusProps {
  nome: string;
  cor: string;
  className?: string;
}

// Pill com bolinha usada para status/tipo de status em tabelas (configurações e
// dashboard). A cor é dado do tenant, não classe Tailwind, então borda/texto/fundo
// saem de `color-mix` no `style` — mesmo idioma do kanban e dos cards do dashboard.
export function BadgeStatus({ nome, cor, className }: BadgeStatusProps) {
  return (
    <Badge
      variant="outline"
      className={`gap-1.5 font-normal ${className ?? ""}`.trim()}
      style={{
        borderColor: `color-mix(in oklch, ${cor}, transparent 50%)`,
        color: cor,
        backgroundColor: `color-mix(in oklch, ${cor}, transparent 92%)`,
      }}
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: cor }}
      />
      {nome}
    </Badge>
  );
}
