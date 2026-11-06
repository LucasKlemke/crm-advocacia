import { aplicarTratamentos, TRATAMENTOS_DISPONIVEIS } from "./campanha-tratamentos";

describe("aplicarTratamentos — extração de partes do nome", () => {
  it("primeiro_nome pega só a primeira palavra", () => {
    expect(aplicarTratamentos("Ana Maria da Silva", ["primeiro_nome"])).toBe("Ana");
  });

  it("ultimo_nome pega só a última palavra", () => {
    expect(aplicarTratamentos("Ana Maria da Silva", ["ultimo_nome"])).toBe("Silva");
  });

  it("primeiro_e_ultimo_nome descarta os nomes do meio", () => {
    expect(aplicarTratamentos("Ana Maria da Silva", ["primeiro_e_ultimo_nome"])).toBe("Ana Silva");
  });

  it("com um nome só, as três extrações devolvem o mesmo valor", () => {
    expect(aplicarTratamentos("Ana", ["primeiro_nome"])).toBe("Ana");
    expect(aplicarTratamentos("Ana", ["ultimo_nome"])).toBe("Ana");
    expect(aplicarTratamentos("Ana", ["primeiro_e_ultimo_nome"])).toBe("Ana");
  });

  it("ignora espaços extras entre os nomes", () => {
    expect(aplicarTratamentos("  Ana   Maria  ", ["ultimo_nome"])).toBe("Maria");
  });

  it("valor vazio continua vazio", () => {
    expect(aplicarTratamentos("", ["primeiro_nome"])).toBe("");
    expect(aplicarTratamentos("   ", ["ultimo_nome"])).toBe("");
  });
});

describe("aplicarTratamentos — caixa", () => {
  it("maiusculas", () => {
    expect(aplicarTratamentos("Ana Maria", ["maiusculas"])).toBe("ANA MARIA");
  });

  it("minusculas", () => {
    expect(aplicarTratamentos("Ana MARIA", ["minusculas"])).toBe("ana maria");
  });

  it("titulo põe maiúscula em cada nome", () => {
    expect(aplicarTratamentos("ANA MARIA SILVA", ["titulo"])).toBe("Ana Maria Silva");
  });

  // "maria DE souza" não pode virar "Maria De Souza": em pt-BR a partícula fica minúscula.
  it("titulo mantém partículas em minúsculo", () => {
    expect(aplicarTratamentos("maria DE souza", ["titulo"])).toBe("Maria de Souza");
    expect(aplicarTratamentos("joao das neves", ["titulo"])).toBe("Joao das Neves");
  });

  it("titulo capitaliza a partícula quando ela é a primeira palavra", () => {
    expect(aplicarTratamentos("da silva", ["titulo"])).toBe("Da Silva");
  });

  it("capitalizar põe maiúscula só no primeiro nome", () => {
    expect(aplicarTratamentos("ANA MARIA SILVA", ["capitalizar"])).toBe("Ana maria silva");
  });

  it("titulo e capitalizar preservam acentos", () => {
    expect(aplicarTratamentos("joão", ["titulo"])).toBe("João");
    expect(aplicarTratamentos("ÂNGELA maria", ["capitalizar"])).toBe("Ângela maria");
  });
});

describe("aplicarTratamentos — remover acentos", () => {
  it("troca letras acentuadas pelas equivalentes sem acento", () => {
    expect(aplicarTratamentos("João Conceição", ["remover_acentos"])).toBe("Joao Conceicao");
  });

  it("preserva a caixa original", () => {
    expect(aplicarTratamentos("ÂNGELA", ["remover_acentos"])).toBe("ANGELA");
  });
});

describe("aplicarTratamentos — cadeia", () => {
  // O caso que o usuário pediu: "maiúscula apenas no primeiro nome" sai da combinação.
  it("aplica os tratamentos na ordem em que foram escolhidos", () => {
    expect(aplicarTratamentos("ANA MARIA SILVA", ["primeiro_nome", "titulo"])).toBe("Ana");
  });

  it("a ordem importa quando os tratamentos não comutam", () => {
    expect(aplicarTratamentos("ana maria silva", ["titulo", "ultimo_nome"])).toBe("Silva");
    expect(aplicarTratamentos("ana maria silva", ["ultimo_nome", "titulo"])).toBe("Silva");
  });

  it("cadeia vazia devolve o valor original", () => {
    expect(aplicarTratamentos("Ana Maria", [])).toBe("Ana Maria");
  });

  it("combina extração, caixa e remoção de acento", () => {
    expect(aplicarTratamentos("joão da conceição", ["primeiro_nome", "titulo", "remover_acentos"])).toBe(
      "Joao"
    );
  });

  it("ignora tratamento desconhecido em vez de quebrar a mensagem", () => {
    expect(aplicarTratamentos("Ana", ["nao_existe" as never])).toBe("Ana");
  });
});

describe("TRATAMENTOS_DISPONIVEIS", () => {
  it("expõe um rótulo em pt-BR e um exemplo para cada tratamento", () => {
    expect(TRATAMENTOS_DISPONIVEIS.length).toBeGreaterThan(0);
    for (const item of TRATAMENTOS_DISPONIVEIS) {
      expect(item.rotulo.length).toBeGreaterThan(0);
      expect(item.exemplo.length).toBeGreaterThan(0);
    }
  });

  it("o exemplo de cada tratamento confere com o que a função faz", () => {
    for (const item of TRATAMENTOS_DISPONIVEIS) {
      expect(aplicarTratamentos(item.exemploEntrada, [item.id])).toBe(item.exemplo);
    }
  });
});
