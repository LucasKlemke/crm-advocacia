import { deveAcompanharMensagens, INTERVALO_ACOMPANHAMENTO_MS } from "./acompanhar-mensagens";

const AGORA = Date.parse("2026-11-06T22:00:00.000Z");
const minutosAtras = (min: number) => new Date(AGORA - min * 60_000).toISOString();

describe("deveAcompanharMensagens", () => {
  it("relê a cada 5 s", () => {
    expect(INTERVALO_ACOMPANHAMENTO_MS).toBe(5000);
  });

  it.each(["agendada", "enviando"] as const)("acompanha campanha %s", (status) => {
    expect(
      deveAcompanharMensagens({ status, updatedAt: minutosAtras(60) }, ["lida"], AGORA)
    ).toBe(true);
  });

  it("acompanha campanha concluída há pouco com destinatário ainda pendente", () => {
    expect(
      deveAcompanharMensagens(
        { status: "concluida", updatedAt: minutosAtras(2) },
        ["entregue", "pendente"],
        AGORA
      )
    ).toBe(true);
  });

  it("acompanha campanha concluída há pouco com destinatário ainda sem status", () => {
    expect(
      deveAcompanharMensagens(
        { status: "concluida", updatedAt: minutosAtras(2) },
        ["entregue", undefined],
        AGORA
      )
    ).toBe(true);
  });

  it("para quando nenhum destinatário está pendente", () => {
    expect(
      deveAcompanharMensagens(
        { status: "concluida", updatedAt: minutosAtras(2) },
        ["entregue", "enviada", "falha"],
        AGORA
      )
    ).toBe(false);
  });

  it("para 10 minutos depois da última mudança da campanha, mesmo com pendência", () => {
    const campanha = { status: "concluida" as const, updatedAt: minutosAtras(10) };
    expect(deveAcompanharMensagens(campanha, ["pendente"], AGORA)).toBe(false);
    expect(
      deveAcompanharMensagens({ ...campanha, updatedAt: minutosAtras(9.9) }, ["pendente"], AGORA)
    ).toBe(true);
  });

  it.each(["pausada", "excluindo"] as const)("não acompanha campanha %s", (status) => {
    expect(
      deveAcompanharMensagens({ status, updatedAt: minutosAtras(1) }, ["pendente"], AGORA)
    ).toBe(false);
  });

  it("sem linhas na página não há o que acompanhar depois de concluída", () => {
    expect(
      deveAcompanharMensagens({ status: "concluida", updatedAt: minutosAtras(1) }, [], AGORA)
    ).toBe(false);
  });
});
