import {
  formatarDataHora,
  formatarDataHoraCurta,
  formatarHora,
  formatarIntervaloEvento,
} from "./data";

describe("formatarDataHora", () => {
  it("formata data e hora por extenso", () => {
    expect(formatarDataHora("2026-08-19T17:10:00.000Z")).toBe("19 de ago. de 2026, 14:10");
  });

  it("devolve travessão para data inválida", () => {
    expect(formatarDataHora("nao-e-data")).toBe("—");
  });
});

// Usada onde a data é contexto, não conteúdo (o cabeçalho do drawer de cliente):
// precisa caber em uma linha discreta ao lado de outra data.
describe("formatarDataHoraCurta", () => {
  it("formata em dd/mm/aaaa hh:mm", () => {
    expect(formatarDataHoraCurta("2026-08-19T17:10:00.000Z")).toBe("19/08/2026 14:10");
  });

  it("devolve travessão para data inválida", () => {
    expect(formatarDataHoraCurta("nao-e-data")).toBe("—");
  });
});

describe("formatarHora", () => {
  it("formata a hora local em 24h", () => {
    expect(formatarHora(new Date(2026, 8, 10, 14, 5))).toBe("14:05");
  });

  it("devolve travessão para data inválida", () => {
    expect(formatarHora("ontem")).toBe("—");
  });
});

describe("formatarIntervaloEvento", () => {
  it("mostra a faixa de horas quando início e fim são no mesmo dia", () => {
    const texto = formatarIntervaloEvento(
      new Date(2026, 8, 10, 14, 0),
      new Date(2026, 8, 10, 15, 30)
    );
    expect(texto).toContain("14:00 – 15:30");
    expect(texto).toContain("10");
  });

  it("marca dia inteiro sem mostrar horas", () => {
    const texto = formatarIntervaloEvento(
      new Date(2026, 8, 10, 0, 0),
      new Date(2026, 8, 10, 23, 59, 59, 999),
      true
    );
    expect(texto).toContain("dia inteiro");
    expect(texto).not.toContain("00:00");
  });

  it("mostra os dois dias quando o evento atravessa a meia-noite", () => {
    const texto = formatarIntervaloEvento(
      new Date(2026, 8, 10, 22, 0),
      new Date(2026, 8, 11, 2, 0)
    );
    expect(texto).toContain("→");
    expect(texto).toContain("22:00");
    expect(texto).toContain("02:00");
  });

  it("devolve travessão para data inválida", () => {
    expect(formatarIntervaloEvento("ontem", "amanhã")).toBe("—");
  });
});
