import {
  extrairVariaveis,
  normalizarChave,
  renderizarMensagem,
  sugerirMapeamento,
  variaveisNaoMapeadas,
} from "./campanha-mensagem";

describe("extrairVariaveis", () => {
  it("extrai as variáveis na ordem em que aparecem", () => {
    expect(extrairVariaveis("Olá {{nome}}, seu processo {{processo}} andou.")).toEqual([
      "nome",
      "processo",
    ]);
  });

  it("não repete uma variável usada mais de uma vez", () => {
    expect(extrairVariaveis("{{nome}}, tudo bem {{nome}}?")).toEqual(["nome"]);
  });

  it("tolera espaços dentro das chaves", () => {
    expect(extrairVariaveis("Olá {{ nome }}!")).toEqual(["nome"]);
  });

  it("aceita acentos e números no nome da variável", () => {
    expect(extrairVariaveis("{{endereço}} {{telefone2}}")).toEqual(["endereço", "telefone2"]);
  });

  it("devolve lista vazia quando não há variável", () => {
    expect(extrairVariaveis("Mensagem fixa para todo mundo.")).toEqual([]);
  });

  it("ignora chaves simples e chaves vazias", () => {
    expect(extrairVariaveis("{nome} {{}} {{ }}")).toEqual([]);
  });
});

describe("normalizarChave", () => {
  it("ignora caixa, acento e espaço nas pontas", () => {
    expect(normalizarChave("  Endereço  ")).toBe("endereco");
  });

  it("troca separadores por underscore", () => {
    expect(normalizarChave("Nome Completo")).toBe("nome_completo");
    expect(normalizarChave("nome-completo")).toBe("nome_completo");
  });

  it("colapsa separadores repetidos", () => {
    expect(normalizarChave("nome   completo")).toBe("nome_completo");
  });
});

describe("sugerirMapeamento", () => {
  it("casa a variável com a coluna de mesmo nome", () => {
    expect(sugerirMapeamento(["nome"], ["nome", "numero"])).toEqual({ nome: "nome" });
  });

  it("casa ignorando caixa e acento", () => {
    expect(sugerirMapeamento(["endereco"], ["Endereço"])).toEqual({ endereco: "Endereço" });
  });

  it("casa 'nome_completo' com a coluna 'Nome Completo'", () => {
    expect(sugerirMapeamento(["nome_completo"], ["Nome Completo"])).toEqual({
      nome_completo: "Nome Completo",
    });
  });

  it("deixa null a variável sem coluna correspondente, para o usuário escolher", () => {
    expect(sugerirMapeamento(["nome", "apelido"], ["nome"])).toEqual({
      nome: "nome",
      apelido: null,
    });
  });

  it("preserva o nome original da coluna, não a versão normalizada", () => {
    const mapeamento = sugerirMapeamento(["nome"], ["NOME"]);
    expect(mapeamento.nome).toBe("NOME");
  });
});

describe("variaveisNaoMapeadas", () => {
  it("lista as variáveis do template sem coluna definida", () => {
    expect(variaveisNaoMapeadas("Olá {{nome}} do {{bairro}}", { nome: "nome" })).toEqual([
      "bairro",
    ]);
  });

  it("trata mapeamento para coluna vazia como não mapeado", () => {
    expect(variaveisNaoMapeadas("Olá {{nome}}", { nome: "" })).toEqual(["nome"]);
  });

  it("devolve vazio quando tudo está mapeado", () => {
    expect(variaveisNaoMapeadas("Olá {{nome}}", { nome: "Nome" })).toEqual([]);
  });
});

describe("renderizarMensagem", () => {
  it("substitui a variável pelo valor da coluna mapeada", () => {
    const texto = renderizarMensagem(
      "Olá, por acaso estou falando com {{nome}}?",
      { Nome: "Ana", numero: "5511999999999" },
      { nome: "Nome" }
    );
    expect(texto).toBe("Olá, por acaso estou falando com Ana?");
  });

  it("substitui todas as ocorrências da mesma variável", () => {
    expect(renderizarMensagem("{{n}} e {{n}}", { n: "x" }, { n: "n" })).toBe("x e x");
  });

  it("respeita espaços dentro das chaves", () => {
    expect(renderizarMensagem("Olá {{ nome }}!", { nome: "Ana" }, { nome: "nome" })).toBe(
      "Olá Ana!"
    );
  });

  it("substitui por string vazia quando a coluna existe mas a célula está vazia", () => {
    expect(renderizarMensagem("Olá {{nome}}!", { nome: "" }, { nome: "nome" })).toBe("Olá !");
  });

  it("mantém o placeholder quando a variável não tem mapeamento", () => {
    expect(renderizarMensagem("Olá {{nome}}!", { nome: "Ana" }, {})).toBe("Olá {{nome}}!");
  });

  // Um valor de célula com "$&" seria interpretado como padrão de substituição pelo
  // String.replace e duplicaria o trecho casado — o valor precisa entrar literal.
  it("trata o valor da célula como texto literal, sem padrões de substituição", () => {
    expect(renderizarMensagem("Oi {{v}}", { v: "$& $` $'" }, { v: "v" })).toBe("Oi $& $` $'");
  });
});
