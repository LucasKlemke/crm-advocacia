"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { calcularLayoutDia, minutoParaPct, pctParaMinuto } from "@/lib/utils/agenda-layout";
import { recortarNoDia, type SegmentoDia } from "@/lib/utils/agenda-eventos";
import { chaveDoDia, ehHoje } from "@/lib/utils/agenda-grade";
import { BlocoEvento } from "./bloco-evento";
import type { EventoDTO } from "@/types/evento";

// Hora em que a grade abre o scroll: começar em 00:00 desperdiça metade da tela num
// escritório, e começar no primeiro evento do dia esconde a manhã quando o dia está vazio.
const HORA_PADRAO_SCROLL = 7;
const HORAS = Array.from({ length: 24 }, (_, hora) => hora);

export interface FaixaHorasProps {
  dias: Date[];
  eventos: EventoDTO[];
  onSelecionarEvento: (evento: EventoDTO) => void;
  onSelecionarSlot: (inicio: Date, fim: Date) => void;
}

// A matemática de posição vive toda em agenda-layout.ts (módulo puro e testado); aqui
// só sobra traduzir BlocoPosicionado em top/height/left/width, e cuidar do scroll.
export function FaixaHoras({
  dias,
  eventos,
  onSelecionarEvento,
  onSelecionarSlot,
}: FaixaHorasProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [agora, setAgora] = useState(() => new Date());

  const segmentosPorDia = dias.map((dia) =>
    eventos
      .map((evento) => recortarNoDia(evento, dia))
      .filter((segmento): segmento is SegmentoDia => segmento !== null)
  );

  // A linha "agora" só precisa da precisão do minuto — um intervalo de 60s evita
  // re-render por segundo numa tela que fica aberta o dia inteiro.
  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const elemento = scroller.current;
    if (!elemento) return;
    const primeiroMinuto = segmentosPorDia
      .flat()
      .reduce<number | null>(
        (menor, segmento) =>
          menor === null ? segmento.inicioMin : Math.min(menor, segmento.inicioMin),
        null
      );
    const minutoAlvo = Math.min(primeiroMinuto ?? HORA_PADRAO_SCROLL * 60, HORA_PADRAO_SCROLL * 60);
    elemento.scrollTop = (elemento.scrollHeight * minutoAlvo) / 1440;
    // Reposiciona quando a faixa de dias muda (navegar/trocar de visão), não a cada
    // re-render por causa do relógio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dias.map((d) => chaveDoDia(d)).join(",")]);

  function criarNoSlot(dia: Date, evento: React.MouseEvent<HTMLDivElement>) {
    const caixa = evento.currentTarget.getBoundingClientRect();
    const pct = ((evento.clientY - caixa.top) / caixa.height) * 100;
    const minuto = pctParaMinuto(pct);
    const inicio = new Date(dia);
    inicio.setHours(0, minuto, 0, 0);
    onSelecionarSlot(inicio, new Date(inicio.getTime() + 3_600_000));
  }

  return (
    <div
      ref={scroller}
      className="relative flex-1 overflow-y-auto"
      style={{ ["--altura-hora" as string]: "3rem" }}
    >
      <div className="flex min-h-full">
        {/* Régua de horas: sticky para não sumir no scroll horizontal do mobile. */}
        <div className="sticky left-0 z-10 w-14 shrink-0 bg-background">
          {HORAS.map((hora) => (
            <div
              key={hora}
              className="relative h-[var(--altura-hora)] border-r border-border pr-1 text-right"
            >
              {hora > 0 ? (
                <span className="absolute -top-2 right-1 text-[11px] text-muted-foreground">
                  {String(hora).padStart(2, "0")}:00
                </span>
              ) : null}
            </div>
          ))}
        </div>

        {dias.map((dia, indiceDia) => {
          const blocos = calcularLayoutDia(segmentosPorDia[indiceDia]);
          const dentroDeHoje = ehHoje(dia, agora);

          return (
            <div
              key={chaveDoDia(dia)}
              data-testid={`coluna-dia-${chaveDoDia(dia)}`}
              onClick={(clique) => criarNoSlot(dia, clique)}
              className="relative flex-1 border-r border-border last:border-r-0"
              role="presentation"
            >
              {HORAS.map((hora) => (
                <div
                  key={hora}
                  className={cn(
                    "h-[var(--altura-hora)] border-b border-border/60",
                    dentroDeHoje && "bg-primary/[0.03]"
                  )}
                />
              ))}

              {blocos.map((bloco) => (
                <BlocoEvento
                  key={`${bloco.item.evento.id}-${indiceDia}`}
                  evento={bloco.item.evento}
                  continuaAntes={bloco.item.continuaAntes}
                  continuaDepois={bloco.item.continuaDepois}
                  estilo={{
                    top: `${bloco.topoPct}%`,
                    height: `${bloco.alturaPct}%`,
                    left: `calc(${bloco.esquerdaPct}% + 2px)`,
                    width: `calc(${bloco.larguraPct}% - 4px)`,
                  }}
                  onSelecionar={onSelecionarEvento}
                />
              ))}

              {dentroDeHoje ? (
                <div
                  className="pointer-events-none absolute inset-x-0 z-20 border-t border-destructive"
                  style={{
                    top: `${minutoParaPct(agora.getHours() * 60 + agora.getMinutes())}%`,
                  }}
                  aria-hidden
                >
                  <span className="absolute -top-1 -left-1 size-2 rounded-full bg-destructive" />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
