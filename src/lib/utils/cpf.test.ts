import { normalizarCpf, formatarCpf, mascararCpf, cpfValido } from "@/lib/utils/cpf";

describe("normalizarCpf", () => {
  it("remove máscara e mantém só os dígitos", () => {
    expect(normalizarCpf("529.982.247-25")).toBe("52998224725");
  });

  it("remove espaços em volta", () => {
    expect(normalizarCpf("  52998224725  ")).toBe("52998224725");
  });

  it("devolve string vazia quando não há dígitos", () => {
    expect(normalizarCpf("abc.-")).toBe("");
  });
});

describe("formatarCpf", () => {
  it("aplica a máscara 000.000.000-00", () => {
    expect(formatarCpf("52998224725")).toBe("529.982.247-25");
  });

  it("formata mesmo recebendo um CPF já mascarado", () => {
    expect(formatarCpf("529.982.247-25")).toBe("529.982.247-25");
  });

  it("devolve o valor original quando não tem 11 dígitos", () => {
    expect(formatarCpf("123")).toBe("123");
  });
});

describe("cpfValido", () => {
  it("aceita CPF com dígitos verificadores corretos", () => {
    expect(cpfValido("52998224725")).toBe(true);
    expect(cpfValido("529.982.247-25")).toBe(true);
  });

  it("rejeita CPF com dígito verificador errado", () => {
    expect(cpfValido("52998224724")).toBe(false);
  });

  it("rejeita CPF com quantidade de dígitos diferente de 11", () => {
    expect(cpfValido("5299822472")).toBe(false);
    expect(cpfValido("529982247255")).toBe(false);
  });

  // Sequências repetidas passam no cálculo dos dígitos, mas não são CPFs reais.
  it("rejeita sequências de dígitos repetidos", () => {
    expect(cpfValido("00000000000")).toBe(false);
    expect(cpfValido("11111111111")).toBe(false);
  });

  it("rejeita string vazia", () => {
    expect(cpfValido("")).toBe(false);
  });
});

describe("mascararCpf", () => {
  // Máscara progressiva: o campo formata enquanto o usuário digita.
  it("formata parcialmente conforme os dígitos chegam", () => {
    expect(mascararCpf("083")).toBe("083");
    expect(mascararCpf("1234")).toBe("123.4");
    expect(mascararCpf("123456789")).toBe("123.456.789");
    expect(mascararCpf("12345678909")).toBe("123.456.789-09");
  });

  it("ignora dígitos além dos 11 do formato", () => {
    expect(mascararCpf("1234567890912")).toBe("123.456.789-09");
  });

  it("descarta o que não é dígito", () => {
    expect(mascararCpf("lucas")).toBe("");
    expect(mascararCpf("")).toBe("");
  });
});
