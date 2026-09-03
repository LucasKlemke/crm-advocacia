import { novoEventoSchema, edicaoEventoSchema, filtrosEventosSchema } from "@/lib/api/schemas-evento";

const BASE = {
  titulo: "Audiência de instrução",
  inicio: "2026-09-10T13:00:00.000Z",
  fim: "2026-09-10T14:00:00.000Z",
  modalidade: "presencial" as const,
  local: "Fórum de Joinville, sala 3",
};

describe("novoEventoSchema", () => {
  it("aceita um evento presencial mínimo", () => {
    const r = novoEventoSchema.safeParse(BASE);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.diaInteiro).toBe(false);
      expect(r.data.participanteMembroIds).toEqual([]);
    }
  });

  it("rejeita fim anterior ou igual ao início (RN35)", () => {
    expect(novoEventoSchema.safeParse({ ...BASE, fim: BASE.inicio }).success).toBe(false);
    expect(
      novoEventoSchema.safeParse({ ...BASE, fim: "2026-09-10T12:00:00.000Z" }).success
    ).toBe(false);
  });

  it("aceita início igual ao fim quando é evento de dia inteiro (RN35)", () => {
    const r = novoEventoSchema.safeParse({ ...BASE, diaInteiro: true, fim: BASE.inicio });
    expect(r.success).toBe(true);
  });

  it("aceita data no passado — registro retrospectivo é permitido (RN35)", () => {
    const r = novoEventoSchema.safeParse({
      ...BASE,
      inicio: "2020-01-02T10:00:00.000Z",
      fim: "2020-01-02T11:00:00.000Z",
    });
    expect(r.success).toBe(true);
  });

  it("exige local quando presencial e link quando online (RN32)", () => {
    expect(novoEventoSchema.safeParse({ ...BASE, local: undefined }).success).toBe(false);
    expect(
      novoEventoSchema.safeParse({ ...BASE, modalidade: "online", local: undefined }).success
    ).toBe(false);
    expect(
      novoEventoSchema.safeParse({
        ...BASE,
        modalidade: "online",
        local: undefined,
        linkReuniao: "https://meet.google.com/abc-defg-hij",
      }).success
    ).toBe(true);
  });

  it("rejeita link de reunião que não é URL", () => {
    expect(
      novoEventoSchema.safeParse({
        ...BASE,
        modalidade: "online",
        local: undefined,
        linkReuniao: "sala do zap",
      }).success
    ).toBe(false);
  });

  it("rejeita caso e cliente ao mesmo tempo (RN31)", () => {
    const r = novoEventoSchema.safeParse({
      ...BASE,
      casoId: "11111111-1111-4111-8111-111111111111",
      clienteId: "22222222-2222-4222-8222-222222222222",
    });
    expect(r.success).toBe(false);
  });

  it("aceita vínculo com caso, com cliente ou com nenhum dos dois (RN31)", () => {
    const caso = { ...BASE, casoId: "11111111-1111-4111-8111-111111111111" };
    const cliente = { ...BASE, clienteId: "22222222-2222-4222-8222-222222222222" };
    expect(novoEventoSchema.safeParse(caso).success).toBe(true);
    expect(novoEventoSchema.safeParse(cliente).success).toBe(true);
    expect(novoEventoSchema.safeParse(BASE).success).toBe(true);
  });

  it("rejeita título vazio e participante que não é uuid", () => {
    expect(novoEventoSchema.safeParse({ ...BASE, titulo: "   " }).success).toBe(false);
    expect(novoEventoSchema.safeParse({ ...BASE, participanteMembroIds: ["x"] }).success).toBe(
      false
    );
  });
});

describe("edicaoEventoSchema", () => {
  it("aceita alteração parcial de um campo só", () => {
    const r = edicaoEventoSchema.safeParse({ titulo: "Novo título" });
    expect(r.success).toBe(true);
  });

  // O par início/fim e o par modalidade/campo só podem ser conferidos aqui quando os dois
  // lados vêm no payload; a checagem completa (contra o valor já gravado) é do Service.
  it("rejeita par início/fim invertido quando os dois vêm juntos (RN35)", () => {
    const r = edicaoEventoSchema.safeParse({
      inicio: "2026-09-10T14:00:00.000Z",
      fim: "2026-09-10T13:00:00.000Z",
    });
    expect(r.success).toBe(false);
  });

  it("rejeita caso e cliente juntos também na edição (RN31)", () => {
    const r = edicaoEventoSchema.safeParse({
      casoId: "11111111-1111-4111-8111-111111111111",
      clienteId: "22222222-2222-4222-8222-222222222222",
    });
    expect(r.success).toBe(false);
  });

  // Regressão: com `.default()` nos campos base, o `.partial()` do zod ainda injeta os
  // defaults, e um PATCH só de título chegaria ao Service com participanteMembroIds: []
  // (apagando os participantes) e diaInteiro: false (desligando o dia inteiro).
  it("não injeta defaults em campos não enviados", () => {
    const r = edicaoEventoSchema.safeParse({ titulo: "Novo título" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(Object.keys(r.data)).toEqual(["titulo"]);
    }
  });

  it("aceita desvincular explicitamente com null", () => {
    const r = edicaoEventoSchema.safeParse({ casoId: null, clienteId: null });
    expect(r.success).toBe(true);
  });
});

describe("filtrosEventosSchema", () => {
  it("exige início e fim válidos e em ordem", () => {
    expect(
      filtrosEventosSchema.safeParse({
        inicio: "2026-09-01T00:00:00.000Z",
        fim: "2026-09-30T23:59:59.999Z",
      }).success
    ).toBe(true);
    expect(filtrosEventosSchema.safeParse({ inicio: "2026-09-01T00:00:00.000Z" }).success).toBe(
      false
    );
    expect(
      filtrosEventosSchema.safeParse({
        inicio: "2026-09-30T00:00:00.000Z",
        fim: "2026-09-01T00:00:00.000Z",
      }).success
    ).toBe(false);
  });
});
