import { CORES_STATUS_PERMITIDAS } from "./cores-status";

describe("CORES_STATUS_PERMITIDAS", () => {
  it("não é uma lista vazia", () => {
    expect(CORES_STATUS_PERMITIDAS.length).toBeGreaterThan(0);
  });

  it("não tem cores duplicadas", () => {
    expect(new Set(CORES_STATUS_PERMITIDAS).size).toBe(CORES_STATUS_PERMITIDAS.length);
  });

  it("todas as cores são hex válido de 6 dígitos", () => {
    for (const cor of CORES_STATUS_PERMITIDAS) {
      expect(cor).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("contém as cores usadas nos status padrão da criação de escritório", () => {
    const usadasNosPadroes = [
      "#64748b",
      "#f59e0b",
      "#0ea5e9",
      "#8b5cf6",
      "#10b981",
      "#f43f5e",
    ];
    for (const cor of usadasNosPadroes) {
      expect(CORES_STATUS_PERMITIDAS).toContain(cor);
    }
  });
});
