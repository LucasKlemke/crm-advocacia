"use client";

import { MapPin, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatarHora } from "@/lib/utils/data";
import type { EventoDTO } from "@/types/evento";

export interface BlocoEventoProps {
  evento: EventoDTO;
  // Posição dentro da faixa de horas, em % — a altura de uma hora vive só no CSS
  // (--altura-hora), então o bloco não precisa saber quantos pixels tem uma hora.
  estilo: { top: string; height: string; left: string; width: string };
  continuaAntes?: boolean;
  continuaDepois?: boolean;
  onSelecionar: (evento: EventoDTO) => void;
}

export function BlocoEvento({
  evento,
  estilo,
  continuaAntes,
  continuaDepois,
  onSelecionar,
}: BlocoEventoProps) {
  const Icone = evento.modalidade === "online" ? Video : MapPin;

  return (
    <button
      type="button"
      onClick={() => onSelecionar(evento)}
      style={estilo}
      // Bordas retas do lado que continua no dia vizinho, para o corte ficar legível.
      className={cn(
        "absolute overflow-hidden rounded-md border-l-2 border-primary bg-primary/10 px-1.5 py-0.5 text-left text-xs text-foreground transition-colors hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        continuaAntes && "rounded-t-none",
        continuaDepois && "rounded-b-none"
      )}
      aria-label={`${evento.titulo}, ${formatarHora(evento.inicio)} às ${formatarHora(evento.fim)}`}
    >
      <span className="flex items-center gap-1 font-medium">
        <Icone className="size-3 shrink-0 text-muted-foreground" />
        <span className="truncate">{evento.titulo}</span>
      </span>
      <span className="block truncate text-muted-foreground">
        {formatarHora(evento.inicio)}
      </span>
    </button>
  );
}
