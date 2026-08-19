import { formatarDataHora, formatarDataHoraCurta } from "./data";

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
