// Conversão entre Date e o valor de um <input type="datetime-local">. Módulo puro, sem
// I/O: o navegador lê e escreve esse input em HORA LOCAL, sem fuso, então toda a
// aritmética aqui usa os getters locais.
//
// Regra que motiva o arquivo existir: nunca montar o valor com
// `toISOString().slice(0, 16)`. Isso serializa em UTC e desloca a hora exibida (em
// America/Sao_Paulo, 3 horas para trás), o que já apareceu como bug no `min` do
// agendamento de campanhas — o input liberava horários passados.

export class ValorInputLocalInvalidoError extends Error {
  constructor(mensagem = "Data e hora inválidas.") {
    super(mensagem);
    this.name = "ValorInputLocalInvalidoError";
  }
}

// Aceita com e sem segundos: Chrome envia "2026-09-10T14:30", mas o input passa a
// incluir os segundos quando o valor inicial os tem ou quando `step` é menor que 60.
const PADRAO_INPUT_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

function doisDigitos(valor: number): string {
  return String(valor).padStart(2, "0");
}

export function paraInputLocal(data: Date): string {
  if (Number.isNaN(data.getTime())) {
    throw new ValorInputLocalInvalidoError();
  }
  return (
    `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}` +
    `T${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`
  );
}

export function deInputLocal(valor: string): Date {
  const partes = PADRAO_INPUT_LOCAL.exec(valor);
  if (!partes) {
    throw new ValorInputLocalInvalidoError();
  }

  const [, ano, mes, dia, hora, minuto, segundo] = partes;
  const data = new Date(
    Number(ano),
    Number(mes) - 1,
    Number(dia),
    Number(hora),
    Number(minuto),
    Number(segundo ?? 0)
  );

  // O construtor de Date normaliza excedentes em silêncio (30/02 vira 02/03), então a
  // única forma de detectar uma data inexistente é conferir se os campos voltaram
  // iguais aos que entraram.
  const bateu =
    data.getFullYear() === Number(ano) &&
    data.getMonth() === Number(mes) - 1 &&
    data.getDate() === Number(dia) &&
    data.getHours() === Number(hora) &&
    data.getMinutes() === Number(minuto);
  if (!bateu) {
    throw new ValorInputLocalInvalidoError();
  }

  return data;
}

// `agora` é injetável para os testes não precisarem de fake timers (regra do módulo:
// nenhuma função lê o relógio sem deixar como substituir).
export function agoraParaInputLocal(agora: Date = new Date()): string {
  return paraInputLocal(agora);
}
