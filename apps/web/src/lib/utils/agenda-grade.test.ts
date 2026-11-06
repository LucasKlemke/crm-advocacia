import {
  chaveDoDia,
  diasDaSemana,
  ehForaDoMes,
  ehHoje,
  navegar,
  rangeDaVisao,
  rotuloDoPeriodo,
  semanasDoMes,
} from "@/lib/utils/agenda-grade";

// Datas de referência sempre construídas com o construtor local (ano, mês, dia): a
// grade é desenhada em hora local, então string ISO aqui deixaria o teste dependente
// do fuso da máquina que roda o CI.
const QUINTA_10_SET_2026 = new Date(2026, 8, 10, 15, 42);

describe("rangeDaVisao", () => {
  it("na visão de mês cobre as 42 células, do domingo anterior ao dia 1", () => {
    // Setembro/2026 começa numa terça; a primeira célula é 30/08.
    const { inicio, fim } = rangeDaVisao("mes", QUINTA_10_SET_2026);
    expect(chaveDoDia(inicio)).toBe("2026-08-30");
    expect(inicio.getHours()).toBe(0);
    expect(chaveDoDia(fim)).toBe("2026-10-10");
    expect(fim.getHours()).toBe(23);
    expect(fim.getMinutes()).toBe(59);
    expect(fim.getMilliseconds()).toBe(999);
  });

  it("na visão de semana vai de domingo a sábado", () => {
    const { inicio, fim } = rangeDaVisao("semana", QUINTA_10_SET_2026);
    expect(chaveDoDia(inicio)).toBe("2026-09-06");
    expect(inicio.getDay()).toBe(0);
    expect(chaveDoDia(fim)).toBe("2026-09-12");
    expect(fim.getDay()).toBe(6);
    expect(fim.getHours()).toBe(23);
  });

  it("na visão de dia cobre 00:00 até 23:59:59.999 do próprio dia", () => {
    const { inicio, fim } = rangeDaVisao("dia", QUINTA_10_SET_2026);
    expect(chaveDoDia(inicio)).toBe("2026-09-10");
    expect(chaveDoDia(fim)).toBe("2026-09-10");
    expect(inicio.getHours()).toBe(0);
    expect(inicio.getMinutes()).toBe(0);
    expect(fim.getHours()).toBe(23);
    expect(fim.getMinutes()).toBe(59);
    expect(fim.getSeconds()).toBe(59);
    expect(fim.getMilliseconds()).toBe(999);
  });

  it("não muta a data de foco recebida", () => {
    const foco = new Date(2026, 8, 10, 15, 42);
    rangeDaVisao("mes", foco);
    expect(foco.getTime()).toBe(new Date(2026, 8, 10, 15, 42).getTime());
  });
});

describe("semanasDoMes", () => {
  it("sempre devolve 6 linhas de 7 dias, mesmo num mês que caberia em 5", () => {
    const grade = semanasDoMes(QUINTA_10_SET_2026);
    expect(grade).toHaveLength(6);
    grade.forEach((semana) => expect(semana).toHaveLength(7));
  });

  it("começa no domingo anterior ao dia 1 e termina completando a grade", () => {
    const grade = semanasDoMes(QUINTA_10_SET_2026);
    expect(chaveDoDia(grade[0][0])).toBe("2026-08-30");
    expect(chaveDoDia(grade[5][6])).toBe("2026-10-10");
  });

  it("usa as 6 linhas para um mês que realmente precisa delas", () => {
    // Agosto/2026 começa num sábado e tem 31 dias: 6 linhas são obrigatórias.
    const grade = semanasDoMes(new Date(2026, 7, 15));
    expect(chaveDoDia(grade[0][0])).toBe("2026-07-26");
    expect(chaveDoDia(grade[5][6])).toBe("2026-09-05");
    const contemUltimoDia = grade[5].some((dia) => chaveDoDia(dia) === "2026-08-31");
    expect(contemUltimoDia).toBe(true);
  });

  it("todos os dias começam à meia-noite local", () => {
    semanasDoMes(QUINTA_10_SET_2026)
      .flat()
      .forEach((dia) => {
        expect(dia.getHours()).toBe(0);
        expect(dia.getMinutes()).toBe(0);
      });
  });

  it("cobre a virada de ano na grade de dezembro", () => {
    const grade = semanasDoMes(new Date(2026, 11, 10));
    expect(chaveDoDia(grade[0][0])).toBe("2026-11-29");
    expect(chaveDoDia(grade[5][6])).toBe("2027-01-09");
  });
});

describe("diasDaSemana", () => {
  it("devolve os 7 dias de domingo a sábado", () => {
    const dias = diasDaSemana(QUINTA_10_SET_2026);
    expect(dias).toHaveLength(7);
    expect(dias.map(chaveDoDia)).toEqual([
      "2026-09-06",
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
    ]);
  });

  it("já parte de um domingo sem avançar a semana", () => {
    expect(chaveDoDia(diasDaSemana(new Date(2026, 8, 6, 23, 0))[0])).toBe("2026-09-06");
  });
});

describe("navegar", () => {
  it("avança e volta um mês", () => {
    expect(chaveDoDia(navegar("mes", new Date(2026, 8, 10), 1))).toBe("2026-10-10");
    expect(chaveDoDia(navegar("mes", new Date(2026, 8, 10), -1))).toBe("2026-08-10");
  });

  it("vira o ano na visão de mês", () => {
    expect(chaveDoDia(navegar("mes", new Date(2026, 11, 15), 1))).toBe("2027-01-15");
    expect(chaveDoDia(navegar("mes", new Date(2026, 0, 15), -1))).toBe("2025-12-15");
  });

  it("avança e volta uma semana, virando o ano", () => {
    expect(chaveDoDia(navegar("semana", new Date(2026, 11, 31), 1))).toBe("2027-01-07");
    expect(chaveDoDia(navegar("semana", new Date(2027, 0, 3), -1))).toBe("2026-12-27");
  });

  it("avança e volta um dia, virando mês e ano", () => {
    expect(chaveDoDia(navegar("dia", new Date(2026, 11, 31), 1))).toBe("2027-01-01");
    expect(chaveDoDia(navegar("dia", new Date(2026, 8, 1), -1))).toBe("2026-08-31");
  });

  it("preserva a hora da data de foco", () => {
    const destino = navegar("dia", new Date(2026, 8, 10, 15, 42), 1);
    expect(destino.getHours()).toBe(15);
    expect(destino.getMinutes()).toBe(42);
  });
});

describe("ehHoje", () => {
  it("compara com o agora injetado, não com o relógio da máquina", () => {
    const agora = new Date(2026, 8, 10, 8, 0);
    expect(ehHoje(new Date(2026, 8, 10, 23, 30), agora)).toBe(true);
    expect(ehHoje(new Date(2026, 8, 11, 0, 30), agora)).toBe(false);
  });

  it("sem agora explícito usa o dia corrente", () => {
    expect(ehHoje(new Date())).toBe(true);
  });
});

describe("ehForaDoMes", () => {
  it("marca os dias vizinhos que aparecem na grade", () => {
    expect(ehForaDoMes(new Date(2026, 7, 30), QUINTA_10_SET_2026)).toBe(true);
    expect(ehForaDoMes(new Date(2026, 9, 1), QUINTA_10_SET_2026)).toBe(true);
    expect(ehForaDoMes(new Date(2026, 8, 30), QUINTA_10_SET_2026)).toBe(false);
  });

  it("considera o ano, não só o número do mês", () => {
    expect(ehForaDoMes(new Date(2025, 8, 10), QUINTA_10_SET_2026)).toBe(true);
  });
});

describe("rotuloDoPeriodo", () => {
  it("na visão de mês mostra mês e ano capitalizados", () => {
    expect(rotuloDoPeriodo("mes", QUINTA_10_SET_2026)).toBe("Setembro 2026");
  });

  it("na visão de semana condensa o mês quando a semana não o cruza", () => {
    expect(rotuloDoPeriodo("semana", QUINTA_10_SET_2026)).toBe("6–12 de set de 2026");
  });

  it("na visão de semana repete o mês quando a semana cruza dois meses", () => {
    // 30/08 (domingo) a 05/09 (sábado).
    expect(rotuloDoPeriodo("semana", new Date(2026, 8, 3))).toBe("30 de ago – 5 de set de 2026");
  });

  it("na visão de semana mostra os dois anos quando a semana cruza a virada", () => {
    expect(rotuloDoPeriodo("semana", new Date(2026, 11, 31))).toBe(
      "27 de dez de 2026 – 2 de jan de 2027"
    );
  });

  it("na visão de dia mostra o dia da semana por extenso", () => {
    expect(rotuloDoPeriodo("dia", QUINTA_10_SET_2026)).toBe("Quinta-feira, 10 de setembro");
  });
});

describe("chaveDoDia", () => {
  it("usa a data local no formato YYYY-MM-DD", () => {
    expect(chaveDoDia(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("não desloca o dia à meia-noite local", () => {
    expect(chaveDoDia(new Date(2026, 8, 10, 0, 0))).toBe("2026-09-10");
    expect(chaveDoDia(new Date(2026, 8, 10, 23, 59, 59, 999))).toBe("2026-09-10");
  });
});
