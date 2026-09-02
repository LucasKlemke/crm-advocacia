import { podePausar, podeRetomar } from "./controle-campanha";
import type { CampanhaDTO } from "@/types/campanha";

const TODOS: CampanhaDTO["status"][] = [
  "agendada",
  "enviando",
  "pausada",
  "concluida",
  "excluindo",
];

describe("controle-campanha", () => {
  it("deixa pausar só campanha viva", () => {
    expect(TODOS.filter(podePausar)).toEqual(["agendada", "enviando"]);
  });

  it("deixa retomar só campanha pausada", () => {
    expect(TODOS.filter(podeRetomar)).toEqual(["pausada"]);
  });
});
