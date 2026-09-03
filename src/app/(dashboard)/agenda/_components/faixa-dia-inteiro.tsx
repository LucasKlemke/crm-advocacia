"use client";

import { chaveDoDia } from "@/lib/utils/agenda-grade";
import { ChipEventoMes } from "./chip-evento-mes";
import type { EventoDTO } from "@/types/evento";

export interface FaixaDiaInteiroProps {
  dias: Date[];
  // Já agrupado por dia por quem renderiza (agruparPorDia), para a faixa não repetir
  // a lógica de recorte que a grade de horas também usa.
  porDia: Map<string, EventoDTO[]>;
  onSelecionarEvento: (evento: EventoDTO) => void;
}

// Eventos de dia inteiro (e os que atravessam mais de um dia) ficam fora da faixa de
// horas: numa grade de 24h eles ocupariam a coluna toda e empurrariam os compromissos
// com hora marcada para uma faixa ilegível.
export function FaixaDiaInteiro({ dias, porDia, onSelecionarEvento }: FaixaDiaInteiroProps) {
  const algumEvento = dias.some((dia) => (porDia.get(chaveDoDia(dia))?.length ?? 0) > 0);
  if (!algumEvento) {
    return null;
  }

  return (
    <div className="flex border-b border-border">
      <div className="w-14 shrink-0 border-r border-border pr-1 pt-1 text-right text-[11px] text-muted-foreground">
        Dia
      </div>
      {dias.map((dia) => (
        <div
          key={chaveDoDia(dia)}
          className="flex min-h-8 flex-1 flex-col gap-0.5 border-r border-border p-1 last:border-r-0"
        >
          {(porDia.get(chaveDoDia(dia)) ?? []).map((evento) => (
            <ChipEventoMes
              key={evento.id}
              evento={evento}
              diaInteiro
              onSelecionar={onSelecionarEvento}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
