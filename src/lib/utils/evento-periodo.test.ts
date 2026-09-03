import { normalizarPeriodoEvento, PeriodoEventoInvalidoError } from "@/lib/utils/evento-periodo";

describe("normalizarPeriodoEvento", () => {
  it("mantém início e fim quando o evento tem horário", () => {
    const p = normalizarPeriodoEvento("2026-09-10T13:00:00.000Z", "2026-09-10T14:30:00.000Z", false);
    expect(p.inicio.toISOString()).toBe("2026-09-10T13:00:00.000Z");
    expect(p.fim.toISOString()).toBe("2026-09-10T14:30:00.000Z");
  });

  it("rejeita fim anterior ou igual ao início (RN35)", () => {
    expect(() =>
      normalizarPeriodoEvento("2026-09-10T14:00:00.000Z", "2026-09-10T13:00:00.000Z", false)
    ).toThrow(PeriodoEventoInvalidoError);
    expect(() =>
      normalizarPeriodoEvento("2026-09-10T13:00:00.000Z", "2026-09-10T13:00:00.000Z", false)
    ).toThrow(PeriodoEventoInvalidoError);
  });

  it("expande dia inteiro para 00:00 até 23:59:59.999 em UTC (RN35)", () => {
    const p = normalizarPeriodoEvento("2026-09-10T17:45:00.000Z", "2026-09-10T18:00:00.000Z", true);
    expect(p.inicio.toISOString()).toBe("2026-09-10T00:00:00.000Z");
    expect(p.fim.toISOString()).toBe("2026-09-10T23:59:59.999Z");
  });

  it("cobre a faixa inteira num dia inteiro de vários dias", () => {
    const p = normalizarPeriodoEvento("2026-09-10T10:00:00.000Z", "2026-09-12T08:00:00.000Z", true);
    expect(p.inicio.toISOString()).toBe("2026-09-10T00:00:00.000Z");
    expect(p.fim.toISOString()).toBe("2026-09-12T23:59:59.999Z");
  });

  it("aceita dia inteiro com início e fim no mesmo instante", () => {
    const p = normalizarPeriodoEvento("2026-09-10T00:00:00.000Z", "2026-09-10T00:00:00.000Z", true);
    expect(p.fim.toISOString()).toBe("2026-09-10T23:59:59.999Z");
  });

  it("rejeita dia inteiro com fim em dia anterior ao início (RN35)", () => {
    expect(() =>
      normalizarPeriodoEvento("2026-09-12T00:00:00.000Z", "2026-09-10T00:00:00.000Z", true)
    ).toThrow(PeriodoEventoInvalidoError);
  });

  it("rejeita data inválida", () => {
    expect(() => normalizarPeriodoEvento("ontem", "2026-09-10T13:00:00.000Z", false)).toThrow(
      PeriodoEventoInvalidoError
    );
  });

  it("aceita Date além de string ISO", () => {
    const p = normalizarPeriodoEvento(
      new Date("2026-09-10T13:00:00.000Z"),
      new Date("2026-09-10T14:00:00.000Z"),
      false
    );
    expect(p.fim.getTime() - p.inicio.getTime()).toBe(3_600_000);
  });
});
