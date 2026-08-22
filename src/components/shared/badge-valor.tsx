import { formatarValorBrl } from "@/lib/utils/valor";

export interface BadgeValorProps {
  // Mesmo tipo aceito por `formatarValorBrl`: o Decimal do Prisma chega serializado
  // como string em alguns payloads.
  valor: string | number;
  className?: string;
}

// Pill do valor em R$ (card do kanban e coluna Valor da tabela do dashboard), em
// verde de dinheiro via tokens `valor`/`valor-muted` — nunca cor literal do Tailwind,
// para o tom acompanhar o tema claro/escuro.
export function BadgeValor({ valor, className }: BadgeValorProps) {
  return (
    <span
      className={`inline-flex rounded-full bg-valor-muted px-2.5 py-1 text-xs font-semibold text-valor ${className ?? ""}`.trim()}
    >
      {formatarValorBrl(valor)}
    </span>
  );
}
