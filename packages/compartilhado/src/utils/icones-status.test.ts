import { ICONES_STATUS_PERMITIDOS } from "./icones-status";

describe("ICONES_STATUS_PERMITIDOS", () => {
  it("não é uma lista vazia", () => {
    expect(ICONES_STATUS_PERMITIDOS.length).toBeGreaterThan(0);
  });

  it("não tem nomes duplicados", () => {
    expect(new Set(ICONES_STATUS_PERMITIDOS).size).toBe(ICONES_STATUS_PERMITIDOS.length);
  });

  it("contém os ícones usados nos status padrão da criação de escritório", () => {
    const usadosNosPadroes = [
      "MessageCircle",
      "Search",
      "CircleCheck",
      "FileText",
      "Trophy",
      "CircleX",
    ];
    for (const icone of usadosNosPadroes) {
      expect(ICONES_STATUS_PERMITIDOS).toContain(icone);
    }
  });

  it("todos os nomes são PascalCase (convenção lucide-react)", () => {
    for (const icone of ICONES_STATUS_PERMITIDOS) {
      expect(icone).toMatch(/^[A-Z][A-Za-z0-9]*$/);
    }
  });
});
