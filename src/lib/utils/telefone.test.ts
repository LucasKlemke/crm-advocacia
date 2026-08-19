import {
  normalizarTelefone,
  formatarTelefone,
  mascararTelefone,
  telefoneValido,
} from "@/lib/utils/telefone";

describe("normalizarTelefone", () => {
  it("remove máscara e mantém só os dígitos", () => {
    expect(normalizarTelefone("+55 (47) 99658-9979")).toBe("5547996589979");
  });

  it("devolve string vazia quando não há dígitos", () => {
    expect(normalizarTelefone("Lucas")).toBe("");
  });
});

describe("telefoneValido", () => {
  it("aceita celular completo com país, DDD e nono dígito", () => {
    expect(telefoneValido("5547996589979")).toBe(true);
    expect(telefoneValido("+55 (47) 99658-9979")).toBe(true);
  });

  // O envio de WhatsApp (RN13) exige o número completo: sem o 55 a Uazapi não entrega.
  it("rejeita número sem o código do país", () => {
    expect(telefoneValido("47996589979")).toBe(false);
  });

  it("rejeita número sem DDD", () => {
    expect(telefoneValido("96589979")).toBe(false);
  });

  it("rejeita celular sem o nono dígito", () => {
    expect(telefoneValido("4796589979")).toBe(false);
    expect(telefoneValido("554796589979")).toBe(false);
  });

  it("rejeita texto e sequências curtas", () => {
    expect(telefoneValido("Lucas")).toBe(false);
    expect(telefoneValido("12948125")).toBe(false);
    expect(telefoneValido("")).toBe(false);
  });

  // DDD brasileiro começa em 11; 55 09 ... seria um país/DDD inexistente.
  it("rejeita DDD inexistente", () => {
    expect(telefoneValido("5509996589979")).toBe(false);
  });

  it("rejeita dígitos além dos 13 esperados", () => {
    expect(telefoneValido("55479965899790")).toBe(false);
  });
});

describe("formatarTelefone", () => {
  it("aplica a máscara +55 (00) 00000-0000", () => {
    expect(formatarTelefone("5547996589979")).toBe("+55 (47) 99658-9979");
  });

  it("devolve o valor original quando não é um celular válido", () => {
    expect(formatarTelefone("47996589979")).toBe("47996589979");
    expect(formatarTelefone("")).toBe("");
  });
});

describe("mascararTelefone", () => {
  // Máscara progressiva: o campo formata enquanto o usuário digita.
  it("formata parcialmente conforme os dígitos chegam", () => {
    expect(mascararTelefone("55")).toBe("+55");
    expect(mascararTelefone("5547")).toBe("+55 (47)");
    expect(mascararTelefone("55479965")).toBe("+55 (47) 9965");
    expect(mascararTelefone("5547996589979")).toBe("+55 (47) 99658-9979");
  });

  it("ignora dígitos além dos 13 do formato", () => {
    expect(mascararTelefone("554799658997999")).toBe("+55 (47) 99658-9979");
  });

  // Sem o 55 na frente não dá para saber onde está o DDD: mostra cru e deixa a
  // validação explicar o que falta, em vez de agrupar os dígitos errados.
  it("não mascara enquanto o número não começa com 55", () => {
    expect(mascararTelefone("4799658")).toBe("4799658");
    expect(mascararTelefone("Lucas")).toBe("");
  });

  it("devolve string vazia para entrada vazia", () => {
    expect(mascararTelefone("")).toBe("");
  });
});
