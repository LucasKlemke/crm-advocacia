"use client";

import { cn } from "@/lib/utils";
import { formatarHora } from "@/lib/utils/data";
import type { EventoDTO } from "@/types/evento";

export interface ChipEventoMesProps {
  evento: EventoDTO;
  diaInteiro?: boolean;
  onSelecionar: (evento: EventoDTO) => void;
}

// Chip de uma linha para a célula do mês: sem hora quando é dia inteiro (a hora só
// ocuparia espaço sem informar nada).
export function ChipEventoMes({ evento, diaInteiro, onSelecionar }: ChipEventoMesProps) {
  return (
    <button
      type="button"
      onClick={(clique) => {
        // A célula do dia também é clicável (criar evento): sem isso, abrir um evento
        // existente abriria também o formulário de criação por baixo.
        clique.stopPropagation();
        onSelecionar(evento);
      }}
      className={cn(
        "flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        diaInteiro ? "bg-primary/15 font-medium" : "bg-transparent"
      )}
      aria-label={`${evento.titulo}${diaInteiro ? ", dia inteiro" : `, ${formatarHora(evento.inicio)}`}`}
    >
      {!diaInteiro ? (
        <>
          <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
          <span className="shrink-0 text-muted-foreground">{formatarHora(evento.inicio)}</span>
        </>
      ) : null}
      <span className="truncate">{evento.titulo}</span>
    </button>
  );
}
