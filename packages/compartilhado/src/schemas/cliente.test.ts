import { acaoEmLoteClientesSchema, edicaoClienteSchema, novoClienteSchema } from "./cliente";

const valido = { nome: "Maria da Silva", cpf: "529.982.247-25" };

describe("novoClienteSchema", () => {
  it("aceita nome e CPF válidos, com opcionais vazios", () => {
    const r = novoClienteSchema.safeParse({ ...valido, email: "", telefone: "" });
    expect(r.success).toBe(true);
  });

  it("rejeita CPF inválido com mensagem por campo", () => {
    const r = novoClienteSchema.safeParse({ ...valido, cpf: "111.111.111-11" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]).toMatchObject({ path: ["cpf"] });
  });

  it("rejeita e-mail e telefone malformados", () => {
    const r = novoClienteSchema.safeParse({ ...valido, email: "sem-arroba", telefone: "123" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0]).sort()).toEqual(["email", "telefone"]);
  });

  it("rejeita nome curto", () => {
    expect(novoClienteSchema.safeParse({ ...valido, nome: "Jo" }).success).toBe(false);
  });

  it("converte o nascimento em Date e rejeita sexo fora da lista", () => {
    const ok = novoClienteSchema.parse({ ...valido, nascimento: "1990-05-10" });
    expect(ok.nascimento).toBeInstanceOf(Date);
    expect(novoClienteSchema.safeParse({ ...valido, sexo: "x" }).success).toBe(false);
  });
});

describe("edicaoClienteSchema", () => {
  it("aceita PATCH parcial (campos ausentes não mexem)", () => {
    expect(edicaoClienteSchema.safeParse({ profissao: "Professora" }).success).toBe(true);
  });

  it("valida o CPF quando ele vem no PATCH", () => {
    expect(edicaoClienteSchema.safeParse({ cpf: "123" }).success).toBe(false);
  });
});

describe("acaoEmLoteClientesSchema", () => {
  const id = "0b8a4c2e-6f1d-4a3b-9c5e-7d2f1a0b3c4d";

  it("aceita ids uuid e ação conhecida", () => {
    expect(acaoEmLoteClientesSchema.safeParse({ ids: [id], acao: "desativar" }).success).toBe(true);
  });

  it("rejeita lista vazia, mais de 200 ids e ação desconhecida", () => {
    expect(acaoEmLoteClientesSchema.safeParse({ ids: [], acao: "restaurar" }).success).toBe(false);
    expect(
      acaoEmLoteClientesSchema.safeParse({ ids: Array(201).fill(id), acao: "restaurar" }).success
    ).toBe(false);
    expect(acaoEmLoteClientesSchema.safeParse({ ids: [id], acao: "excluir" }).success).toBe(false);
  });
});
