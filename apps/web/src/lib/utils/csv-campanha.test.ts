import { sugerirColunaNumero } from "./csv-campanha";

describe("sugerirColunaNumero", () => {
  it("encontra a coluna chamada 'numero'", () => {
    expect(sugerirColunaNumero(["nome", "numero"])).toBe("numero");
  });

  it("ignora caixa e acento", () => {
    expect(sugerirColunaNumero(["Nome", "NÚMERO"])).toBe("NÚMERO");
  });

  it("reconhece telefone, whatsapp e celular", () => {
    expect(sugerirColunaNumero(["nome", "Telefone"])).toBe("Telefone");
    expect(sugerirColunaNumero(["nome", "WhatsApp"])).toBe("WhatsApp");
    expect(sugerirColunaNumero(["nome", "Celular"])).toBe("Celular");
  });

  // "numero" antes de "celular": quando a planilha tem as duas, a mais específica ganha.
  it("respeita a ordem de preferência quando há mais de uma candidata", () => {
    expect(sugerirColunaNumero(["celular", "numero"])).toBe("numero");
  });

  it("aceita variações compostas como 'numero_whatsapp'", () => {
    expect(sugerirColunaNumero(["nome", "Numero WhatsApp"])).toBe("Numero WhatsApp");
  });

  it("devolve null quando nenhuma coluna parece de telefone", () => {
    expect(sugerirColunaNumero(["nome", "email"])).toBeNull();
  });

  it("devolve null para planilha sem colunas", () => {
    expect(sugerirColunaNumero([])).toBeNull();
  });
});
