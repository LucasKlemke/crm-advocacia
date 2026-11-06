import { renderHook } from "@testing-library/react";
import { montarTitulo, useTituloPagina } from "./use-titulo-pagina";

describe("useTituloPagina", () => {
  beforeEach(() => {
    document.title = "CRM Advocacia";
  });

  it("aplica o template '<título> | CRM Advocacia'", () => {
    renderHook(() => useTituloPagina("Clientes"));

    expect(document.title).toBe("Clientes | CRM Advocacia");
  });

  it("sem título usa só o nome do produto", () => {
    expect(montarTitulo()).toBe("CRM Advocacia");
  });

  it("acompanha a troca de título", () => {
    const { rerender } = renderHook(({ titulo }) => useTituloPagina(titulo), {
      initialProps: { titulo: "Campanhas" },
    });

    rerender({ titulo: "Nova campanha" });

    expect(document.title).toBe("Nova campanha | CRM Advocacia");
  });

  it("restaura o título anterior ao desmontar", () => {
    document.title = "Antes";
    const { unmount } = renderHook(() => useTituloPagina("Agenda"));

    unmount();

    expect(document.title).toBe("Antes");
  });
});
