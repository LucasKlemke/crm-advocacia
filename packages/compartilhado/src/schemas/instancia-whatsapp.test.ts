import { novaInstanciaWhatsappSchema } from "./instancia-whatsapp";

describe("novaInstanciaWhatsappSchema", () => {
  it("aceita nome e remove espaços", () => {
    expect(novaInstanciaWhatsappSchema.parse({ nome: "  Recepção " })).toEqual({ nome: "Recepção" });
  });

  it("rejeita nome vazio com a mensagem da UI", () => {
    const r = novaInstanciaWhatsappSchema.safeParse({ nome: "   " });
    expect(r.error?.issues[0]?.message).toBe("Nome é obrigatório");
  });
});
