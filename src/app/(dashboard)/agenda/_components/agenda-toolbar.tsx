"use client";

import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { VisaoAgenda } from "@/types/evento";

export interface AgendaToolbarProps {
  visao: VisaoAgenda;
  rotulo: string;
  // Em telas estreitas só a visão de Dia é legível; as outras são escondidas em vez de
  // desabilitadas, para não sugerir uma ação impossível.
  compacto?: boolean;
  onTrocarVisao: (visao: VisaoAgenda) => void;
  onAnterior: () => void;
  onProximo: () => void;
  onHoje: () => void;
  onNovoEvento: () => void;
}

export function AgendaToolbar({
  visao,
  rotulo,
  compacto,
  onTrocarVisao,
  onAnterior,
  onProximo,
  onHoje,
  onNovoEvento,
}: AgendaToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onAnterior}
          aria-label="Período anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onProximo}
          aria-label="Próximo período"
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button type="button" variant="outline" onClick={onHoje}>
          Hoje
        </Button>
        <span className="ml-2 text-sm font-medium sm:text-base">{rotulo}</span>
      </div>

      <div className="flex items-center gap-2">
        {!compacto ? (
          <ToggleGroup
            value={[visao]}
            onValueChange={(valor) => {
              const escolhida = valor[0] as VisaoAgenda | undefined;
              if (escolhida) onTrocarVisao(escolhida);
            }}
            variant="outline"
            spacing={0}
            aria-label="Visão do calendário"
          >
            <ToggleGroupItem value="mes">Mês</ToggleGroupItem>
            <ToggleGroupItem value="semana">Semana</ToggleGroupItem>
            <ToggleGroupItem value="dia">Dia</ToggleGroupItem>
          </ToggleGroup>
        ) : null}

        <Button type="button" onClick={onNovoEvento}>
          <CalendarPlus className="size-4" />
          Novo evento
        </Button>
      </div>
    </div>
  );
}
