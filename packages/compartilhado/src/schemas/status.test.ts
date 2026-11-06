import { CORES_STATUS_PERMITIDAS } from "../utils/cores-status";
import { ICONES_STATUS_PERMITIDOS } from "../utils/icones-status";
import { edicaoStatusSchema, novoStatusSchema } from "./status";

const valido = {
  nome: "Em análise",
  tipoStatusId: "0b8a4c2e-6f1d-4a3b-9c5e-7d2f1a0b3c4d",
  icone: ICONES_STATUS_PERMITIDOS[0],
  cor: CORES_STATUS_PERMITIDAS[0],
};

describe("novoStatusSchema", () => {
  it("aceita status com ícone e cor da lista permitida", () => {
    expect(novoStatusSchema.safeParse(valido).success).toBe(true);
  });

  it("rejeita ícone e cor fora da lista", () => {
    const r = novoStatusSchema.safeParse({ ...valido, icone: "nao-existe", cor: "#123456" });
    expect(r.error?.issues.map((i) => i.message).sort()).toEqual(["Cor inválida.", "Ícone inválido."]);
  });

  it("rejeita tipoStatusId que não é uuid", () => {
    expect(novoStatusSchema.safeParse({ ...valido, tipoStatusId: "abc" }).success).toBe(false);
  });
});

describe("edicaoStatusSchema", () => {
  it("aceita só a descrição (PATCH parcial)", () => {
    expect(edicaoStatusSchema.safeParse({ descricao: null }).success).toBe(true);
  });
});
