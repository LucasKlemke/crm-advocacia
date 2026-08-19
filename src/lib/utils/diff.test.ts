import { calcularDiff } from "@/lib/utils/diff";

interface Alvo {
  nome: string;
  telefone: string | null;
  email: string | null;
}

const antes: Alvo = { nome: "Maria Silva", telefone: "48999990000", email: null };

describe("calcularDiff", () => {
  it("devolve null quando nada mudou", () => {
    expect(calcularDiff(antes, { nome: "Maria Silva" }, ["nome", "telefone", "email"])).toBeNull();
  });

  it("devolve null quando o objeto de mudanças está vazio", () => {
    expect(calcularDiff(antes, {}, ["nome", "telefone", "email"])).toBeNull();
  });

  it("registra antes e depois só dos campos que mudaram", () => {
    const diff = calcularDiff(
      antes,
      { nome: "Maria Silva", telefone: "48988887777" },
      ["nome", "telefone", "email"]
    );
    expect(diff).toEqual({ telefone: { antes: "48999990000", depois: "48988887777" } });
  });

  it("registra transição de null para valor", () => {
    const diff = calcularDiff(antes, { email: "maria@ex.com" }, ["nome", "telefone", "email"]);
    expect(diff).toEqual({ email: { antes: null, depois: "maria@ex.com" } });
  });

  it("registra transição de valor para null", () => {
    const diff = calcularDiff(antes, { telefone: null }, ["nome", "telefone", "email"]);
    expect(diff).toEqual({ telefone: { antes: "48999990000", depois: null } });
  });

  // undefined = campo não enviado no PATCH, diferente de null = campo limpo.
  it("ignora campos undefined", () => {
    expect(calcularDiff(antes, { telefone: undefined }, ["telefone"])).toBeNull();
  });

  it("ignora campos fora da lista permitida", () => {
    const diff = calcularDiff(antes, { nome: "Outro Nome" }, ["telefone"]);
    expect(diff).toBeNull();
  });

  it("acumula múltiplos campos alterados", () => {
    const diff = calcularDiff(
      antes,
      { nome: "Maria S. Souza", email: "maria@ex.com" },
      ["nome", "telefone", "email"]
    );
    expect(diff).toEqual({
      nome: { antes: "Maria Silva", depois: "Maria S. Souza" },
      email: { antes: null, depois: "maria@ex.com" },
    });
  });
});
