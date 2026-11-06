// Normalização da faixa de tempo de um evento (RN35). Módulo puro — sem I/O e sem
// dependência de fuso da máquina — para ser exaustivamente testável e para o Service e
// a UI chegarem sempre ao mesmo resultado a partir do mesmo par de datas.

export class PeriodoEventoInvalidoError extends Error {
  constructor(mensagem = "O fim do evento precisa ser depois do início.") {
    super(mensagem);
    this.name = "PeriodoEventoInvalidoError";
  }
}

export interface PeriodoEvento {
  inicio: Date;
  fim: Date;
}

const UM_DIA_MS = 86_400_000;

function paraData(valor: string | Date): Date {
  const data = valor instanceof Date ? new Date(valor.getTime()) : new Date(valor);
  if (Number.isNaN(data.getTime())) {
    throw new PeriodoEventoInvalidoError("Data e hora do evento inválidas.");
  }
  return data;
}

// Evento de dia inteiro é armazenado como uma faixa concreta (00:00 → 23:59:59.999 em
// UTC) em vez de datas sem hora: assim a mesma query de sobreposição do repositório
// serve para os dois tipos de evento, sem um caminho especial na listagem.
export function normalizarPeriodoEvento(
  inicioBruto: string | Date,
  fimBruto: string | Date,
  diaInteiro: boolean
): PeriodoEvento {
  const inicio = paraData(inicioBruto);
  const fim = paraData(fimBruto);

  if (!diaInteiro) {
    if (fim.getTime() <= inicio.getTime()) {
      throw new PeriodoEventoInvalidoError();
    }
    return { inicio, fim };
  }

  const inicioDoDia = new Date(
    Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate())
  );
  const fimDoDia = new Date(
    Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth(), fim.getUTCDate()) + UM_DIA_MS - 1
  );

  if (fimDoDia.getTime() < inicioDoDia.getTime()) {
    throw new PeriodoEventoInvalidoError();
  }

  return { inicio: inicioDoDia, fim: fimDoDia };
}
