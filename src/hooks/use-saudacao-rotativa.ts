import { useState } from "react";

export const SAUDACOES = [
  "Olá",
  "Bem-vindo de volta",
  "Seja bem-vindo",
  "Olá novamente",
  "Bem-vindo ao seu espaço de trabalho",
];

export const SUBTITULOS = [
  "Aqui está o seu relatório.",
  "Confira o resumo dos seus casos.",
  "Acompanhe o andamento dos seus processos.",
  "Veja os prazos mais próximos.",
  "Este é o panorama atual do seu escritório.",
];

const CHAVE_STORAGE = "dashboard-saudacao-rotativa";
const DURACAO_MS = 6 * 60 * 60 * 1000;

interface SaudacaoArmazenada {
  saudacaoIndice: number;
  subtituloIndice: number;
  sorteadoEm: number;
}

function sortearIndice(tamanho: number): number {
  return Math.floor(Math.random() * tamanho);
}

function sortearNova(): SaudacaoArmazenada {
  return {
    saudacaoIndice: sortearIndice(SAUDACOES.length),
    subtituloIndice: sortearIndice(SUBTITULOS.length),
    sorteadoEm: Date.now(),
  };
}

function lerOuSortear(): SaudacaoArmazenada {
  if (typeof window === "undefined") return sortearNova();

  const bruto = window.localStorage.getItem(CHAVE_STORAGE);
  if (bruto) {
    try {
      const armazenada = JSON.parse(bruto) as SaudacaoArmazenada;
      if (Date.now() - armazenada.sorteadoEm < DURACAO_MS) return armazenada;
    } catch {
      // valor corrompido, cai para o sorteio abaixo
    }
  }

  const nova = sortearNova();
  window.localStorage.setItem(CHAVE_STORAGE, JSON.stringify(nova));
  return nova;
}

export function useSaudacaoRotativa() {
  const [{ saudacaoIndice, subtituloIndice }] = useState(lerOuSortear);

  return {
    saudacao: SAUDACOES[saudacaoIndice],
    subtitulo: SUBTITULOS[subtituloIndice],
  };
}
