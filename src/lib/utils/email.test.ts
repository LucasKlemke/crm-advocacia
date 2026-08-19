import { emailValido, normalizarEmail } from "@/lib/utils/email";

describe("normalizarEmail", () => {
  it("remove espaços e normaliza o caixa", () => {
    expect(normalizarEmail("  Lucas.Klemke84@Gmail.com ")).toBe("lucas.klemke84@gmail.com");
  });
});

describe("emailValido", () => {
  it("aceita e-mail com usuário, arroba e domínio com TLD", () => {
    expect(emailValido("lucas.klemke84@gmail.com")).toBe(true);
    expect(emailValido("  lucas.klemke84@gmail.com  ")).toBe(true);
  });

  it("rejeita texto sem arroba", () => {
    expect(emailValido("lucasklemketeste")).toBe(false);
    expect(emailValido("12345325")).toBe(false);
  });

  it("rejeita e-mail sem domínio ou sem TLD", () => {
    expect(emailValido("lucas@")).toBe(false);
    expect(emailValido("lucas@gmail")).toBe(false);
    expect(emailValido("@gmail.com")).toBe(false);
  });

  it("rejeita e-mail com espaço interno", () => {
    expect(emailValido("lucas klemke@gmail.com")).toBe(false);
  });

  it("rejeita string vazia", () => {
    expect(emailValido("")).toBe(false);
  });
});
