import {
  agoraParaInputLocal,
  deInputLocal,
  paraInputLocal,
  ValorInputLocalInvalidoError,
} from "@/lib/utils/data-input";

describe("paraInputLocal", () => {
  it("formata no padrão do datetime-local usando a hora local", () => {
    expect(paraInputLocal(new Date(2026, 8, 10, 14, 30))).toBe("2026-09-10T14:30");
  });

  it("preenche mês, dia, hora e minuto com dois dígitos", () => {
    expect(paraInputLocal(new Date(2026, 0, 2, 3, 4))).toBe("2026-01-02T03:04");
  });

  it("não desloca a data por causa do fuso (nunca usa UTC)", () => {
    // Meia-noite local: com toISOString() num fuso atrás de Greenwich isso viraria o
    // dia anterior às 21:00 — o bug que este módulo existe para evitar.
    const data = new Date(2026, 8, 10, 0, 0);
    expect(paraInputLocal(data)).toBe("2026-09-10T00:00");
  });

  it("rejeita data inválida", () => {
    expect(() => paraInputLocal(new Date("ontem"))).toThrow(ValorInputLocalInvalidoError);
  });
});

describe("deInputLocal", () => {
  it("interpreta o valor como hora local, não como UTC", () => {
    const data = deInputLocal("2026-09-10T14:30");
    expect(data.getFullYear()).toBe(2026);
    expect(data.getMonth()).toBe(8);
    expect(data.getDate()).toBe(10);
    expect(data.getHours()).toBe(14);
    expect(data.getMinutes()).toBe(30);
    expect(data.getSeconds()).toBe(0);
    expect(data.getMilliseconds()).toBe(0);
  });

  it("aceita o valor com segundos, que alguns navegadores enviam", () => {
    const data = deInputLocal("2026-09-10T14:30:45");
    expect(data.getHours()).toBe(14);
    expect(data.getMinutes()).toBe(30);
    expect(data.getSeconds()).toBe(45);
  });

  it("rejeita valor vazio ou fora do formato", () => {
    expect(() => deInputLocal("")).toThrow(ValorInputLocalInvalidoError);
    expect(() => deInputLocal("10/09/2026 14:30")).toThrow(ValorInputLocalInvalidoError);
    expect(() => deInputLocal("2026-09-10")).toThrow(ValorInputLocalInvalidoError);
  });

  it("rejeita data que não existe no calendário", () => {
    expect(() => deInputLocal("2026-02-30T10:00")).toThrow(ValorInputLocalInvalidoError);
  });
});

describe("round-trip entre paraInputLocal e deInputLocal", () => {
  it.each([
    new Date(2026, 8, 10, 14, 30),
    new Date(2026, 0, 1, 0, 0),
    new Date(2026, 11, 31, 23, 59),
    // Domingo da virada do horário de verão em fusos que o adotam.
    new Date(2026, 9, 18, 12, 0),
  ])("preserva ano, mês, dia, hora e minuto de %s", (original) => {
    const volta = deInputLocal(paraInputLocal(original));
    expect(volta.getFullYear()).toBe(original.getFullYear());
    expect(volta.getMonth()).toBe(original.getMonth());
    expect(volta.getDate()).toBe(original.getDate());
    expect(volta.getHours()).toBe(original.getHours());
    expect(volta.getMinutes()).toBe(original.getMinutes());
  });
});

describe("agoraParaInputLocal", () => {
  it("formata o instante injetado", () => {
    expect(agoraParaInputLocal(new Date(2026, 2, 1, 9, 5))).toBe("2026-03-01T09:05");
  });

  it("sem argumento usa o relógio da máquina no formato do input", () => {
    expect(agoraParaInputLocal()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
