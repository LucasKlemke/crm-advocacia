// Geometria de datas da agenda (visões Mês/Semana/Dia). Módulo puro: recebe a data de
// foco, devolve os dias que a grade precisa desenhar e os rótulos do cabeçalho. Nada
// aqui lê o relógio sem receber `agora`, para os testes não dependerem de fake timers.
//
// Tudo é calculado em HORA LOCAL: a grade é o que o usuário vê no fuso dele, enquanto
// as datas do `EventoDTO` chegam em UTC (ver src/types/evento.ts) e são convertidas na
// borda, em agenda-eventos.ts.

import { addDays } from "date-fns/addDays";
import { addMonths } from "date-fns/addMonths";
import { addWeeks } from "date-fns/addWeeks";
import { isSameDay } from "date-fns/isSameDay";
import { startOfMonth } from "date-fns/startOfMonth";
import { startOfWeek } from "date-fns/startOfWeek";

// Reexportado do tipo canônico (a rota usa a mesma nomenclatura em `?visao=`) em vez de
// declarar uma cópia — um valor novo em src/types/evento.ts quebra este módulo em
// tempo de compilação, que é o comportamento desejado.
export type { VisaoAgenda } from "@/types/evento";
import type { VisaoAgenda } from "@/types/evento";

// A grade do mês é sempre 6×7. Altura fixa evita o calendário "pular" de tamanho ao
// navegar entre um mês de 5 linhas e outro de 6.
export const LINHAS_GRADE_MES = 6;
export const DIAS_POR_SEMANA = 7;

// Semana começa no domingo (padrão pt-BR, já adotado em components/casos/filtro-periodo).
const OPCOES_SEMANA = { weekStartsOn: 0 } as const;

function inicioDoDia(data: Date): Date {
  const copia = new Date(data);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function fimDoDia(data: Date): Date {
  const copia = new Date(data);
  copia.setHours(23, 59, 59, 999);
  return copia;
}

export function chaveDoDia(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

// Primeira célula da grade do mês: o domingo da semana em que cai o dia 1.
function primeiraCelulaDoMes(dataFoco: Date): Date {
  return inicioDoDia(startOfWeek(startOfMonth(dataFoco), OPCOES_SEMANA));
}

export function semanasDoMes(dataFoco: Date): Date[][] {
  const primeira = primeiraCelulaDoMes(dataFoco);
  return Array.from({ length: LINHAS_GRADE_MES }, (_, linha) =>
    Array.from({ length: DIAS_POR_SEMANA }, (_, coluna) =>
      inicioDoDia(addDays(primeira, linha * DIAS_POR_SEMANA + coluna))
    )
  );
}

export function diasDaSemana(dataFoco: Date): Date[] {
  const domingo = inicioDoDia(startOfWeek(dataFoco, OPCOES_SEMANA));
  return Array.from({ length: DIAS_POR_SEMANA }, (_, i) => inicioDoDia(addDays(domingo, i)));
}

// Intervalo fechado que a listagem de eventos precisa pedir à API para preencher a
// visão. No mês vai além do próprio mês de propósito: as células vizinhas também
// mostram eventos.
export function rangeDaVisao(visao: VisaoAgenda, dataFoco: Date): { inicio: Date; fim: Date } {
  if (visao === "dia") {
    return { inicio: inicioDoDia(dataFoco), fim: fimDoDia(dataFoco) };
  }
  if (visao === "semana") {
    const dias = diasDaSemana(dataFoco);
    return { inicio: dias[0], fim: fimDoDia(dias[DIAS_POR_SEMANA - 1]) };
  }
  const primeira = primeiraCelulaDoMes(dataFoco);
  const ultima = addDays(primeira, LINHAS_GRADE_MES * DIAS_POR_SEMANA - 1);
  return { inicio: primeira, fim: fimDoDia(ultima) };
}

export function navegar(visao: VisaoAgenda, dataFoco: Date, passo: -1 | 1): Date {
  if (visao === "dia") return addDays(dataFoco, passo);
  if (visao === "semana") return addWeeks(dataFoco, passo);
  return addMonths(dataFoco, passo);
}

export function ehHoje(data: Date, agora: Date = new Date()): boolean {
  return isSameDay(data, agora);
}

// Comparação por ano+mês (e não só pelo número do mês) porque a grade de dezembro
// mostra células de janeiro do ano seguinte.
export function ehForaDoMes(data: Date, dataFoco: Date): boolean {
  return data.getMonth() !== dataFoco.getMonth() || data.getFullYear() !== dataFoco.getFullYear();
}

const FORMATO_MES_ANO = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const FORMATO_DIA_EXTENSO = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const FORMATO_MES_CURTO = new Intl.DateTimeFormat("pt-BR", { month: "short" });

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// O pt-BR abrevia o mês com ponto ("set."), que fica ruidoso no meio do rótulo do
// período — o mesmo tratamento que a UI já dá em outros lugares.
function mesCurto(data: Date): string {
  return FORMATO_MES_CURTO.format(data).replace(".", "");
}

// "6–12 de set de 2026" quando a semana inteira cai no mesmo mês; caso contrário
// repete o mês em cada ponta ("30 de ago – 5 de set de 2026"), e o ano também quando a
// semana atravessa a virada ("27 de dez de 2026 – 2 de jan de 2027").
function rotuloDaSemana(dataFoco: Date): string {
  const dias = diasDaSemana(dataFoco);
  const primeiro = dias[0];
  const ultimo = dias[DIAS_POR_SEMANA - 1];
  const anoFinal = ultimo.getFullYear();

  if (primeiro.getFullYear() !== anoFinal) {
    return (
      `${primeiro.getDate()} de ${mesCurto(primeiro)} de ${primeiro.getFullYear()}` +
      ` – ${ultimo.getDate()} de ${mesCurto(ultimo)} de ${anoFinal}`
    );
  }
  if (primeiro.getMonth() !== ultimo.getMonth()) {
    return (
      `${primeiro.getDate()} de ${mesCurto(primeiro)}` +
      ` – ${ultimo.getDate()} de ${mesCurto(ultimo)} de ${anoFinal}`
    );
  }
  return `${primeiro.getDate()}–${ultimo.getDate()} de ${mesCurto(ultimo)} de ${anoFinal}`;
}

export function rotuloDoPeriodo(visao: VisaoAgenda, dataFoco: Date): string {
  if (visao === "dia") return capitalizar(FORMATO_DIA_EXTENSO.format(dataFoco));
  if (visao === "semana") return rotuloDaSemana(dataFoco);
  // "setembro de 2026" → "Setembro 2026": o cabeçalho é curto e o "de" só ocupa espaço.
  return capitalizar(FORMATO_MES_ANO.format(dataFoco).replace(" de ", " "));
}
