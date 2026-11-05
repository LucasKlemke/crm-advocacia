"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface PeriodoFiltro {
  dataInicio: string | null;
  dataFim: string | null;
}

export interface FiltroPeriodoProps {
  valor: PeriodoFiltro;
  onChange: (periodo: PeriodoFiltro) => void;
}

interface Preset {
  label: string;
  intervalo: () => { inicio: Date; fim: Date };
}

function iniciarDia(data: Date): Date {
  const copia = new Date(data);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function terminarDia(data: Date): Date {
  const copia = new Date(data);
  copia.setHours(23, 59, 59, 999);
  return copia;
}

const PRESETS: Preset[] = [
  {
    label: "Hoje",
    intervalo: () => {
      const hoje = new Date();
      return { inicio: iniciarDia(hoje), fim: terminarDia(hoje) };
    },
  },
  {
    label: "Esta semana",
    intervalo: () => {
      const hoje = new Date();
      const inicio = new Date(hoje);
      inicio.setDate(hoje.getDate() - hoje.getDay());
      return { inicio: iniciarDia(inicio), fim: terminarDia(hoje) };
    },
  },
  {
    label: "Últimos 30 dias",
    intervalo: () => {
      const hoje = new Date();
      const inicio = new Date(hoje);
      inicio.setDate(hoje.getDate() - 29);
      return { inicio: iniciarDia(inicio), fim: terminarDia(hoje) };
    },
  },
  {
    label: "Este mês",
    intervalo: () => {
      const hoje = new Date();
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      return { inicio: iniciarDia(inicio), fim: terminarDia(hoje) };
    },
  },
  {
    label: "Últimos 90 dias",
    intervalo: () => {
      const hoje = new Date();
      const inicio = new Date(hoje);
      inicio.setDate(hoje.getDate() - 89);
      return { inicio: iniciarDia(inicio), fim: terminarDia(hoje) };
    },
  },
  {
    label: "Este trimestre",
    intervalo: () => {
      const hoje = new Date();
      const trimestre = Math.floor(hoje.getMonth() / 3);
      const inicio = new Date(hoje.getFullYear(), trimestre * 3, 1);
      return { inicio: iniciarDia(inicio), fim: terminarDia(hoje) };
    },
  },
  {
    label: "Este ano",
    intervalo: () => {
      const hoje = new Date();
      const inicio = new Date(hoje.getFullYear(), 0, 1);
      return { inicio: iniciarDia(inicio), fim: terminarDia(hoje) };
    },
  },
];

function formatarCurto(data: Date): string {
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// Popover com atalhos de período + calendário de intervalo (mode="range"). Os presets
// calculam datas em JS puro (sem date-fns) — o range final vira dataInicio/dataFim
// ISO, no formato já esperado pelo backend (gte/lte sobre createdAt).
export function FiltroPeriodo({ valor, onChange }: FiltroPeriodoProps) {
  const [aberto, setAberto] = useState(false);

  const range: DateRange | undefined =
    valor.dataInicio || valor.dataFim
      ? {
          from: valor.dataInicio ? new Date(valor.dataInicio) : undefined,
          to: valor.dataFim ? new Date(valor.dataFim) : undefined,
        }
      : undefined;

  const rotulo =
    range?.from && range?.to
      ? `${formatarCurto(range.from)} – ${formatarCurto(range.to)}`
      : "Data de criação";

  function aplicarPreset(preset: Preset) {
    const { inicio, fim } = preset.intervalo();
    onChange({ dataInicio: inicio.toISOString(), dataFim: fim.toISOString() });
    setAberto(false);
  }

  function aplicarRange(novo: DateRange | undefined) {
    onChange({
      dataInicio: novo?.from ? iniciarDia(novo.from).toISOString() : null,
      dataFim: novo?.to ? terminarDia(novo.to).toISOString() : null,
    });
  }

  function limpar() {
    onChange({ dataInicio: null, dataFim: null });
    setAberto(false);
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger
        render={<Button type="button" variant="outline" size="sm" aria-label="Filtrar por data de criação" />}
      >
        <CalendarIcon className="size-4" />
        {rotulo}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <div className="flex">
          <div className="flex w-40 flex-col gap-0.5 border-r border-border p-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => aplicarPreset(preset)}
                className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={limpar}
              className="mt-1 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent"
            >
              Limpar
            </button>
          </div>
          <Calendar
            mode="range"
            selected={range}
            onSelect={aplicarRange}
            numberOfMonths={2}
            defaultMonth={range?.from}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
