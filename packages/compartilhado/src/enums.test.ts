import {
  ROLES_MEMBRO,
  STATUS_CAMPANHA,
  STATUS_INSTANCIA_WHATSAPP,
  TIPOS_ARQUIVO,
} from "./enums";

// A paridade com os enums do Prisma é verificada na API
// (apps/api/src/dominio/enums-compartilhados.test.ts). Aqui só garantimos a ordem
// e os valores esperados pelas telas.
describe("enums compartilhados", () => {
  it("expõe os papéis de membro em ordem de hierarquia decrescente", () => {
    expect(ROLES_MEMBRO).toEqual(["owner", "admin", "padrao"]);
  });

  it("expõe o ciclo de vida de campanha", () => {
    expect(STATUS_CAMPANHA).toEqual(["agendada", "enviando", "pausada", "concluida", "excluindo"]);
  });

  it("expõe os estados de instância de WhatsApp", () => {
    expect(STATUS_INSTANCIA_WHATSAPP).toEqual([
      "disconnected",
      "connecting",
      "connected",
      "hibernated",
    ]);
  });

  it("expõe os tipos de arquivo aceitos (RN18)", () => {
    expect(TIPOS_ARQUIVO).toEqual(["pdf", "docx", "jpg", "png", "jpeg"]);
  });
});
