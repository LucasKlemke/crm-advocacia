import { lerConfigTempoReal } from "./config-tempo-real";

describe("lerConfigTempoReal", () => {
  it("usa os padrões quando nada está definido: habilitado, polling de 15 s, sem origens extras", () => {
    expect(lerConfigTempoReal({})).toEqual({ habilitado: true, pollingMs: 15000, origensWeb: [] });
  });

  it('só "false" desliga o tempo real; qualquer outro valor mantém ligado', () => {
    expect(lerConfigTempoReal({ TEMPO_REAL_HABILITADO: "false" }).habilitado).toBe(false);
    expect(lerConfigTempoReal({ TEMPO_REAL_HABILITADO: " FALSE " }).habilitado).toBe(false);
    expect(lerConfigTempoReal({ TEMPO_REAL_HABILITADO: "true" }).habilitado).toBe(true);
    expect(lerConfigTempoReal({ TEMPO_REAL_HABILITADO: "0" }).habilitado).toBe(true);
    expect(lerConfigTempoReal({ TEMPO_REAL_HABILITADO: "" }).habilitado).toBe(true);
  });

  it("sem TEMPO_REAL_HABILITADO, desliga na Vercel (VERCEL definido) e liga fora dela", () => {
    expect(lerConfigTempoReal({ VERCEL: "1" }).habilitado).toBe(false);
    expect(lerConfigTempoReal({ VERCEL: "1", TEMPO_REAL_HABILITADO: "" }).habilitado).toBe(false);
    expect(lerConfigTempoReal({}).habilitado).toBe(true);
  });

  it("valor explícito de TEMPO_REAL_HABILITADO sempre prevalece sobre o padrão da Vercel", () => {
    expect(lerConfigTempoReal({ VERCEL: "1", TEMPO_REAL_HABILITADO: "true" }).habilitado).toBe(true);
    expect(lerConfigTempoReal({ VERCEL: "1", TEMPO_REAL_HABILITADO: "false" }).habilitado).toBe(false);
  });

  it('"0" desliga o polling e um número válido vira o intervalo', () => {
    expect(lerConfigTempoReal({ TEMPO_REAL_POLLING_MS: "0" }).pollingMs).toBe(0);
    expect(lerConfigTempoReal({ TEMPO_REAL_POLLING_MS: "5000" }).pollingMs).toBe(5000);
  });

  it("valor inválido ou negativo de polling volta ao padrão", () => {
    expect(lerConfigTempoReal({ TEMPO_REAL_POLLING_MS: "abc" }).pollingMs).toBe(15000);
    expect(lerConfigTempoReal({ TEMPO_REAL_POLLING_MS: "-10" }).pollingMs).toBe(15000);
    expect(lerConfigTempoReal({ TEMPO_REAL_POLLING_MS: "" }).pollingMs).toBe(15000);
  });

  it("WEB_ORIGINS separa por vírgula, apara espaços, descarta vazios e barra final", () => {
    expect(
      lerConfigTempoReal({ WEB_ORIGINS: " https://a.vercel.app , ,https://b.com/,," }).origensWeb
    ).toEqual(["https://a.vercel.app", "https://b.com"]);
    expect(lerConfigTempoReal({ WEB_ORIGINS: "  " }).origensWeb).toEqual([]);
  });

  it("lê process.env quando nenhum env é passado", () => {
    const anterior = process.env.TEMPO_REAL_POLLING_MS;
    process.env.TEMPO_REAL_POLLING_MS = "1234";
    try {
      expect(lerConfigTempoReal().pollingMs).toBe(1234);
    } finally {
      if (anterior === undefined) delete process.env.TEMPO_REAL_POLLING_MS;
      else process.env.TEMPO_REAL_POLLING_MS = anterior;
    }
  });
});
