import { novoTipoProcessoSchema, edicaoTipoProcessoSchema } from "./schemas-tipo-processo";

const VALIDO = { nome: "Juros abusivos", icone: "Briefcase", cor: "#6366f1" };

describe("novoTipoProcessoSchema", () => {
  it("aceita um payload válido", () => {
    expect(novoTipoProcessoSchema.safeParse(VALIDO).success).toBe(true);
  });

  it("trima o nome", () => {
    const parsed = novoTipoProcessoSchema.safeParse({ ...VALIDO, nome: "  Divórcio  " });
    expect(parsed.success && parsed.data.nome).toBe("Divórcio");
  });

  it("rejeita nome vazio", () => {
    expect(novoTipoProcessoSchema.safeParse({ ...VALIDO, nome: "   " }).success).toBe(false);
  });

  it("rejeita nome maior que 60 caracteres", () => {
    expect(novoTipoProcessoSchema.safeParse({ ...VALIDO, nome: "a".repeat(61) }).success).toBe(
      false
    );
  });

  it("rejeita ícone fora da allow-list", () => {
    expect(novoTipoProcessoSchema.safeParse({ ...VALIDO, icone: "IconeInventado" }).success).toBe(
      false
    );
  });

  it("rejeita cor fora da paleta permitida (sem hex arbitrário)", () => {
    expect(novoTipoProcessoSchema.safeParse({ ...VALIDO, cor: "#abcdef" }).success).toBe(false);
  });

  it("aceita descricao nula e rejeita acima de 255 caracteres", () => {
    expect(novoTipoProcessoSchema.safeParse({ ...VALIDO, descricao: null }).success).toBe(true);
    expect(
      novoTipoProcessoSchema.safeParse({ ...VALIDO, descricao: "a".repeat(256) }).success
    ).toBe(false);
  });
});

describe("edicaoTipoProcessoSchema", () => {
  it("aceita payload parcial (PATCH)", () => {
    expect(edicaoTipoProcessoSchema.safeParse({ nome: "Só o nome" }).success).toBe(true);
    expect(edicaoTipoProcessoSchema.safeParse({}).success).toBe(true);
  });

  it("valida os campos que vierem", () => {
    expect(edicaoTipoProcessoSchema.safeParse({ cor: "#abcdef" }).success).toBe(false);
  });
});
