"use client";

import { cn } from "@/lib/utils";
import { agruparPorDia, separarDiaInteiro } from "@/lib/utils/agenda-eventos";
import { chaveDoDia, ehHoje } from "@/lib/utils/agenda-grade";
import { FaixaDiaInteiro } from "./faixa-dia-inteiro";
import { FaixaHoras } from "./faixa-horas";
import type { EventoDTO } from "@/types/evento";

const FORMATO_DIA_SEMANA = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });

export interface GradeSemanaProps {
  dias: Date[];
  eventos: EventoDTO[];
  onSelecionarEvento: (evento: EventoDTO) => void;
  onSelecionarSlot: (inicio: Date, fim: Date) => void;
}

// Semana e Dia são a mesma composição (cabeçalho + faixa de dia inteiro + faixa de
// horas) com 7 ou 1 coluna — daí este componente receber `dias` em vez de uma data.
export function GradeSemana({
  dias,
  eventos,
  onSelecionarEvento,
  onSelecionarSlot,
}: GradeSemanaProps) {
  const { diaInteiro, comHorario } = separarDiaInteiro(eventos);
  const diaInteiroPorDia = agruparPorDia(diaInteiro, dias);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border">
      <div className="flex border-b border-border bg-muted/30">
        <div className="w-14 shrink-0 border-r border-border" />
        {dias.map((dia) => (
          <div
            key={chaveDoDia(dia)}
            className="flex-1 border-r border-border px-2 py-1.5 text-center last:border-r-0"
          >
            <span className="block text-[11px] uppercase text-muted-foreground">
              {FORMATO_DIA_SEMANA.format(dia).replace(".", "")}
            </span>
            <span
              className={cn(
                "mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full text-sm font-medium",
                ehHoje(dia) && "bg-primary text-primary-foreground"
              )}
            >
              {dia.getDate()}
            </span>
          </div>
        ))}
      </div>

      <FaixaDiaInteiro
        dias={dias}
        porDia={diaInteiroPorDia}
        onSelecionarEvento={onSelecionarEvento}
      />

      <FaixaHoras
        dias={dias}
        eventos={comHorario}
        onSelecionarEvento={onSelecionarEvento}
        onSelecionarSlot={onSelecionarSlot}
      />
    </div>
  );
}
