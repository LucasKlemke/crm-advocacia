import type { InstanciaWhatsapp } from "@prisma/client";
import { serializarInstancia } from "./serializa-instancia";

const linha: InstanciaWhatsapp = {
  id: "inst-1",
  escritorioId: "esc-1",
  nome: "Atendimento",
  uazapiInstanceId: "uaz-1",
  uazapiToken: "token-secreto",
  status: "connected",
  numeroConectado: "5511999999999",
  fotoPerfilUrl: "https://foto",
  softDeletedAt: null,
  createdAt: new Date("2026-11-01T10:00:00.000Z"),
  updatedAt: new Date("2026-11-02T10:00:00.000Z"),
};

describe("serializarInstancia", () => {
  it("devolve o DTO de /api/instancias com datas ISO e sem o uazapiToken", () => {
    const dto = serializarInstancia(linha);

    expect(dto).toEqual({
      id: "inst-1",
      escritorioId: "esc-1",
      nome: "Atendimento",
      uazapiInstanceId: "uaz-1",
      status: "connected",
      numeroConectado: "5511999999999",
      fotoPerfilUrl: "https://foto",
      softDeletedAt: null,
      createdAt: "2026-11-01T10:00:00.000Z",
      updatedAt: "2026-11-02T10:00:00.000Z",
    });
    expect(JSON.stringify(dto)).not.toContain("token-secreto");
  });

  it("serializa softDeletedAt da instância excluída", () => {
    const dto = serializarInstancia({ ...linha, softDeletedAt: new Date("2026-11-03T00:00:00.000Z") });
    expect(dto.softDeletedAt).toBe("2026-11-03T00:00:00.000Z");
  });
});
