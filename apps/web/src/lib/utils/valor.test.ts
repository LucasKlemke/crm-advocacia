import { formatarValorBrl } from "./valor";

describe("formatarValorBrl", () => {
  it("formata número como moeda brasileira", () => {
    expect(formatarValorBrl(1500)).toBe("R$ 1.500,00");
  });

  it("formata string vinda do Decimal serializado", () => {
    expect(formatarValorBrl("2500.50")).toBe("R$ 2.500,50");
  });

  it("devolve travessão para null ou undefined", () => {
    expect(formatarValorBrl(null)).toBe("–");
    expect(formatarValorBrl(undefined)).toBe("–");
  });

  it("devolve travessão para valor não numérico", () => {
    expect(formatarValorBrl("abc")).toBe("–");
  });
});
