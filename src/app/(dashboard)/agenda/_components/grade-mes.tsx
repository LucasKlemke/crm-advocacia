"use client";

import { cn } from "@/lib/utils";
import { agruparPorDia, ordenarEventos, ocupaDiaInteiroNaGrade } from "@/lib/utils/agenda-eventos";
import { chaveDoDia, ehForaDoMes, ehHoje, semanasDoMes } from "@/lib/utils/agenda-grade";
import { ChipEventoMes } from "./chip-evento-mes";
import type { EventoDTO } from "@/types/evento";

// Acima disso a célula do dia vira uma lista rolável e ilegível; o resto vai para o
// "+N" que leva à visão de dia.
const MAX_CHIPS_POR_DIA = 3;

const CABECALHOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export interface GradeMesProps {
  dataFoco: Date;
  eventos: EventoDTO[];
  onSelecionarEvento: (evento: EventoDTO) => void;
  onSelecionarDia: (dia: Date) => void;
  onVerDia: (dia: Date) => void;
}

export function GradeMes({
  dataFoco,
  eventos,
  onSelecionarEvento,
  onSelecionarDia,
  onVerDia,
}: GradeMesProps) {
  const semanas = semanasDoMes(dataFoco);
  const porDia = agruparPorDia(ordenarEventos(eventos), semanas.flat());

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {CABECALHOS.map((rotulo) => (
          <div
            key={rotulo}
            className="border-r border-border px-2 py-1.5 text-center text-[11px] uppercase text-muted-foreground last:border-r-0"
          >
            {rotulo}
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-6 overflow-y-auto">
        {semanas.map((semana, indiceSemana) => (
          <div key={indiceSemana} className="grid grid-cols-7 border-b border-border last:border-b-0">
            {semana.map((dia) => {
              const doDia = porDia.get(chaveDoDia(dia)) ?? [];
              const visiveis = doDia.slice(0, MAX_CHIPS_POR_DIA);
              const restantes = doDia.length - visiveis.length;

              return (
                <div
                  key={chaveDoDia(dia)}
                  // Clicar no espaço vazio do dia cria um evento ali, como no Google
                  // Calendar. O chip do evento faz stopPropagation para não colidir.
                  onClick={() => onSelecionarDia(dia)}
                  role="presentation"
                  className={cn(
                    "flex min-h-24 cursor-pointer flex-col gap-0.5 border-r border-border p-1 transition-colors last:border-r-0 hover:bg-muted/40",
                    ehForaDoMes(dia, dataFoco) && "bg-muted/20"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center self-start rounded-full text-xs",
                      ehForaDoMes(dia, dataFoco) && "text-muted-foreground",
                      ehHoje(dia) && "bg-primary font-medium text-primary-foreground"
                    )}
                  >
                    {dia.getDate()}
                  </span>

                  {visiveis.map((evento) => (
                    <ChipEventoMes
                      key={evento.id}
                      evento={evento}
                      diaInteiro={ocupaDiaInteiroNaGrade(evento)}
                      onSelecionar={onSelecionarEvento}
                    />
                  ))}

                  {restantes > 0 ? (
                    <button
                      type="button"
                      onClick={(clique) => {
                        clique.stopPropagation();
                        onVerDia(dia);
                      }}
                      className="self-start px-1 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      +{restantes} mais
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
