// Ponte entre o EventoDTO (datas em string ISO UTC) e a geometria da agenda (minutos
// locais). É aqui — e só aqui — que a conversão UTC → hora local acontece: o servidor
// nunca decide fuso (ver src/types/evento.ts) e agenda-layout.ts só fala em minutos.
// Módulo puro, sem I/O.

import { isSameDay } from "date-fns/isSameDay";
import type { EventoDTO } from "@/types/evento";
import { chaveDoDia } from "./agenda-grade";
import { minutosDoDia } from "./agenda-layout";

const MINUTOS_POR_DIA = 1440;

export interface SegmentoDia {
  evento: EventoDTO;
  inicioMin: number;
  fimMin: number;
  continuaAntes: boolean;
  continuaDepois: boolean;
}

function paraData(iso: string): Date | null {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? null : data;
}

// Data inválida no DTO não pode derrubar a grade inteira: o evento é tratado como
// inexistente e a agenda continua desenhando os outros.
function faixaLocal(evento: EventoDTO): { inicio: Date; fim: Date } | null {
  const inicio = paraData(evento.inicio);
  const fim = paraData(evento.fim);
  if (!inicio || !fim) return null;
  return { inicio, fim: fim.getTime() < inicio.getTime() ? inicio : fim };
}

// "Ocupa dia inteiro na grade" = vai para a faixa fixa no topo da visão, e não para a
// coluna de horas. Um evento com hora que atravessa a meia-noite também entra aí, como
// no Google Calendar: desenhá-lo como bloco na coluna exigiria quebrá-lo em pedaços
// visualmente desconectados.
export function ocupaDiaInteiroNaGrade(evento: EventoDTO): boolean {
  if (evento.diaInteiro) return true;
  const faixa = faixaLocal(evento);
  if (!faixa) return false;
  // Compara com o último instante ocupado (fim − 1ms): um 22:00 → 00:00 termina no
  // limite do dia seguinte sem ocupá-lo, e para o usuário é um evento de um só dia.
  const ultimoInstante = new Date(Math.max(faixa.fim.getTime() - 1, faixa.inicio.getTime()));
  return !isSameDay(faixa.inicio, ultimoInstante);
}

export function separarDiaInteiro(eventos: EventoDTO[]): {
  diaInteiro: EventoDTO[];
  comHorario: EventoDTO[];
} {
  const diaInteiro: EventoDTO[] = [];
  const comHorario: EventoDTO[] = [];
  eventos.forEach((evento) => {
    if (ocupaDiaInteiroNaGrade(evento)) diaInteiro.push(evento);
    else comHorario.push(evento);
  });
  return { diaInteiro, comHorario };
}

// Ordem estável de exibição: início ascendente; no mesmo início o dia inteiro vem
// primeiro (é o contexto do dia, não um compromisso pontual) e o título desempata, para
// dois eventos idênticos no horário não trocarem de lugar entre renderizações.
export function ordenarEventos(eventos: EventoDTO[]): EventoDTO[] {
  return [...eventos].sort((a, b) => {
    const inicioA = new Date(a.inicio).getTime();
    const inicioB = new Date(b.inicio).getTime();
    if (inicioA !== inicioB) return inicioA - inicioB;
    if (a.diaInteiro !== b.diaInteiro) return a.diaInteiro ? -1 : 1;
    return a.titulo.localeCompare(b.titulo, "pt-BR");
  });
}

// Recorta o evento na janela do dia local, em minutos. Devolve null quando não há
// interseção — o chamador usa isso como "este evento não aparece neste dia".
export function recortarNoDia(evento: EventoDTO, dia: Date): SegmentoDia | null {
  const faixa = faixaLocal(evento);
  if (!faixa) return null;

  const inicioDoDia = new Date(dia);
  inicioDoDia.setHours(0, 0, 0, 0);
  const inicioDoDiaSeguinte = new Date(inicioDoDia);
  inicioDoDiaSeguinte.setDate(inicioDoDia.getDate() + 1);

  // Janela semiaberta [00:00, 00:00 do dia seguinte): um evento que termina exatamente
  // à meia-noite pertence só ao dia anterior, senão apareceria como uma fatia de altura
  // zero no topo do dia seguinte.
  if (
    faixa.fim.getTime() <= inicioDoDia.getTime() ||
    faixa.inicio.getTime() >= inicioDoDiaSeguinte.getTime()
  ) {
    return null;
  }

  // Os minutos vêm do relógio de parede (minutosDoDia) e não de uma subtração de
  // timestamps: num dia de virada de horário de verão o dia local não tem 1440 minutos,
  // e é o relógio que o usuário lê na régua de horas.
  const comecaNesteDia = faixa.inicio.getTime() > inicioDoDia.getTime();
  const terminaNesteDia = faixa.fim.getTime() < inicioDoDiaSeguinte.getTime();

  return {
    evento,
    inicioMin: comecaNesteDia ? minutosDoDia(faixa.inicio) : 0,
    fimMin: terminaNesteDia ? minutosDoDia(faixa.fim) : MINUTOS_POR_DIA,
    continuaAntes: !comecaNesteDia && faixa.inicio.getTime() < inicioDoDia.getTime(),
    continuaDepois: !terminaNesteDia && faixa.fim.getTime() > inicioDoDiaSeguinte.getTime(),
  };
}

// Índice dia → eventos para a grade não varrer a lista inteira por célula. Todos os
// dias pedidos ganham chave (com array vazio quando nada cai neles), então o
// componente indexa direto, sem `?? []`; dias fora da lista nunca entram no Map.
export function agruparPorDia(
  eventos: EventoDTO[],
  dias: Date[]
): Map<string, EventoDTO[]> {
  const mapa = new Map<string, EventoDTO[]>();
  dias.forEach((dia) => mapa.set(chaveDoDia(dia), []));

  ordenarEventos(eventos).forEach((evento) => {
    dias.forEach((dia) => {
      if (recortarNoDia(evento, dia)) {
        mapa.get(chaveDoDia(dia))?.push(evento);
      }
    });
  });

  return mapa;
}
