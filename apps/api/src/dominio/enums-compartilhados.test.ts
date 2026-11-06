import { RoleMembro, StatusCampanha, StatusInstanciaWhatsapp, TipoArquivo } from "@prisma/client";
import {
  ROLES_MEMBRO,
  STATUS_CAMPANHA,
  STATUS_INSTANCIA_WHATSAPP,
  TIPOS_ARQUIVO,
} from "@crm/compartilhado/enums";

// O web não depende do Prisma: os enums que atravessam a fronteira HTTP são
// espelhados em @crm/compartilhado/enums. Este teste quebra quando uma migration
// muda um desses enums sem atualizar o espelho.
describe("paridade dos enums compartilhados com o schema Prisma", () => {
  it.each([
    ["RoleMembro", Object.values(RoleMembro), ROLES_MEMBRO],
    ["StatusCampanha", Object.values(StatusCampanha), STATUS_CAMPANHA],
    ["StatusInstanciaWhatsapp", Object.values(StatusInstanciaWhatsapp), STATUS_INSTANCIA_WHATSAPP],
    ["TipoArquivo", Object.values(TipoArquivo), TIPOS_ARQUIVO],
  ])("%s tem os mesmos valores", (_nome, doPrisma, compartilhado) => {
    expect([...doPrisma].sort()).toEqual([...compartilhado].sort());
  });
});
