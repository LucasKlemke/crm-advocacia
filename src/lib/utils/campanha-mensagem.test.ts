import {
  extrairVariaveis,
  normalizarChave,
  normalizarMapeamento,
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
    expect(sugerirMapeamento(["nome"], ["nome", "numero"])).toEqual({
      nome: { coluna: "nome", tratamentos: [] },
    });
  });

  it("casa ignorando caixa e acento", () => {
    expect(sugerirMapeamento(["endereco"], ["Endereço"])).toEqual({
      endereco: { coluna: "Endereço", tratamentos: [] },
    });
  });

  it("casa 'nome_completo' com a coluna 'Nome Completo'", () => {
    expect(sugerirMapeamento(["nome_completo"], ["Nome Completo"])).toEqual({
      nome_completo: { coluna: "Nome Completo", tratamentos: [] },
    });
  });

  it("deixa null a variável sem coluna correspondente, para o usuário escolher", () => {
    expect(sugerirMapeamento(["nome", "apelido"], ["nome"])).toEqual({
      nome: { coluna: "nome", tratamentos: [] },
      apelido: null,
    });
  });

  it("preserva o nome original da coluna, não a versão normalizada", () => {
    expect(sugerirMapeamento(["nome"], ["NOME"]).nome?.coluna).toBe("NOME");
  });
});

describe("variaveisNaoMapeadas", () => {
  it("lista as variáveis do template sem coluna definida", () => {
    expect(
      variaveisNaoMapeadas("Olá {{nome}} do {{bairro}}", { nome: { coluna: "nome" } })
    ).toEqual(["bairro"]);
  });

  it("trata mapeamento para coluna vazia como não mapeado", () => {
    expect(variaveisNaoMapeadas("Olá {{nome}}", { nome: { coluna: "" } })).toEqual(["nome"]);
  });

  it("devolve vazio quando tudo está mapeado", () => {
    expect(variaveisNaoMapeadas("Olá {{nome}}", { nome: { coluna: "Nome" } })).toEqual([]);
  });
});

describe("renderizarMensagem", () => {
  it("substitui a variável pelo valor da coluna mapeada", () => {
    const texto = renderizarMensagem(
      "Olá, por acaso estou falando com {{nome}}?",
      { Nome: "Ana", numero: "5511999999999" },
      { nome: { coluna: "Nome" } }
    );
    expect(texto).toBe("Olá, por acaso estou falando com Ana?");
  });

  it("substitui todas as ocorrências da mesma variável", () => {
    expect(renderizarMensagem("{{n}} e {{n}}", { n: "x" }, { n: { coluna: "n" } })).toBe("x e x");
  });

  it("respeita espaços dentro das chaves", () => {
    expect(renderizarMensagem("Olá {{ nome }}!", { nome: "Ana" }, { nome: { coluna: "nome" } })).toBe(
      "Olá Ana!"
    );
  });

  it("substitui por string vazia quando a coluna existe mas a célula está vazia", () => {
    expect(renderizarMensagem("Olá {{nome}}!", { nome: "" }, { nome: { coluna: "nome" } })).toBe(
      "Olá !"
    );
  });

  it("mantém o placeholder quando a variável não tem mapeamento", () => {
    expect(renderizarMensagem("Olá {{nome}}!", { nome: "Ana" }, {})).toBe("Olá {{nome}}!");
  });

  // Um valor de célula com "$&" seria interpretado como padrão de substituição pelo
  // String.replace e duplicaria o trecho casado — o valor precisa entrar literal.
  it("trata o valor da célula como texto literal, sem padrões de substituição", () => {
    expect(renderizarMensagem("Oi {{v}}", { v: "$& $` $'" }, { v: { coluna: "v" } })).toBe(
      "Oi $& $` $'"
    );
  });
});

describe("renderizarMensagem — tratamentos", () => {
  const linha = { Nome: "ANA MARIA DA SILVA" };

  it("aplica o tratamento configurado na variável", () => {
    expect(
      renderizarMensagem("Olá {{nome}}!", linha, {
        nome: { coluna: "Nome", tratamentos: ["primeiro_nome"] },
      })
    ).toBe("Olá ANA!");
  });

  it("aplica a cadeia na ordem escolhida", () => {
    expect(
      renderizarMensagem("Olá {{nome}}!", linha, {
        nome: { coluna: "Nome", tratamentos: ["primeiro_nome", "titulo"] },
      })
    ).toBe("Olá Ana!");
  });

  it("sem tratamento, o valor entra como está na planilha", () => {
    expect(renderizarMensagem("Olá {{nome}}!", linha, { nome: { coluna: "Nome" } })).toBe(
      "Olá ANA MARIA DA SILVA!"
    );
  });

  it("cada variável tem sua própria cadeia", () => {
    expect(
      renderizarMensagem("{{a}} / {{b}}", linha, {
        a: { coluna: "Nome", tratamentos: ["primeiro_nome", "titulo"] },
        b: { coluna: "Nome", tratamentos: ["ultimo_nome", "maiusculas"] },
      })
    ).toBe("Ana / SILVA");
  });
});

describe("renderizarMensagem — valor padrão", () => {
  it("usa o padrão quando a célula está vazia", () => {
    expect(
      renderizarMensagem("Olá, {{nome}}!", { Nome: "" }, { nome: { coluna: "Nome", padrao: "tudo bem" } })
    ).toBe("Olá, tudo bem!");
  });

  it("usa o padrão quando a célula só tem espaços", () => {
    expect(
      renderizarMensagem("Olá, {{nome}}!", { Nome: "   " }, { nome: { coluna: "Nome", padrao: "tudo bem" } })
    ).toBe("Olá, tudo bem!");
  });

  it("ignora o padrão quando há valor", () => {
    expect(
      renderizarMensagem("Olá, {{nome}}!", { Nome: "Ana" }, { nome: { coluna: "Nome", padrao: "tudo bem" } })
    ).toBe("Olá, Ana!");
  });

  // O padrão é o texto final, não uma entrada para a cadeia: quem escreveu "tudo bem" não
  // espera que "só o primeiro nome" o transforme em "tudo".
  it("não aplica os tratamentos sobre o valor padrão", () => {
    expect(
      renderizarMensagem("Olá, {{nome}}!", { Nome: "" }, {
        nome: { coluna: "Nome", tratamentos: ["primeiro_nome"], padrao: "tudo bem" },
      })
    ).toBe("Olá, tudo bem!");
  });

  it("cai para string vazia quando não há padrão configurado", () => {
    expect(renderizarMensagem("Olá, {{nome}}!", { Nome: "" }, { nome: { coluna: "Nome" } })).toBe(
      "Olá, !"
    );
  });
});

// Campanhas criadas antes dos tratamentos guardaram o mapeamento como
// { variavel: "Coluna" }. A tela de detalhe lê esse Json direto do banco e não pode
// quebrar por causa do formato antigo.
describe("normalizarMapeamento", () => {
  it("converte o formato antigo (string) para config", () => {
    expect(normalizarMapeamento({ nome: "Nome" })).toEqual({
      nome: { coluna: "Nome", tratamentos: [] },
    });
  });

  it("mantém o formato novo, preservando tratamentos e padrão", () => {
    expect(
      normalizarMapeamento({ nome: { coluna: "Nome", tratamentos: ["titulo"], padrao: "cliente" } })
    ).toEqual({ nome: { coluna: "Nome", tratamentos: ["titulo"], padrao: "cliente" } });
  });

  it("descarta tratamento desconhecido vindo do banco", () => {
    expect(normalizarMapeamento({ nome: { coluna: "Nome", tratamentos: ["titulo", "xpto"] } })).toEqual(
      { nome: { coluna: "Nome", tratamentos: ["titulo"] } }
    );
  });

  it("devolve objeto vazio para null/undefined/valor não-objeto", () => {
    expect(normalizarMapeamento(null)).toEqual({});
    expect(normalizarMapeamento(undefined)).toEqual({});
    expect(normalizarMapeamento("texto solto")).toEqual({});
  });

  it("ignora entrada sem coluna utilizável", () => {
    expect(normalizarMapeamento({ nome: { tratamentos: ["titulo"] }, bairro: 42 })).toEqual({});
  });
});
