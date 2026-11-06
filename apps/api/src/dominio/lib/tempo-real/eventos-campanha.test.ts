import { eventosCampanha, type EventoCampanha } from "./eventos-campanha";
import type { CampanhaDTO } from "@crm/compartilhado/tipos/campanha";

function evento(escritorioId: string, id = "campanha-1"): EventoCampanha {
  return {
    tipo: "campanha.atualizada",
    escritorioId,
    campanha: { id, escritorioId } as CampanhaDTO,
  };
}

describe("eventosCampanha", () => {
  const cancelamentos: (() => void)[] = [];

  afterEach(() => {
    cancelamentos.splice(0).forEach((cancelar) => cancelar());
  });

  function assinar(escritorioId: string, ouvinte: (e: EventoCampanha) => void) {
    cancelamentos.push(eventosCampanha.assinar(escritorioId, ouvinte));
  }

  it("entrega o evento a todos os ouvintes do escritório", () => {
    const primeiro = jest.fn();
    const segundo = jest.fn();
    assinar("esc-a", primeiro);
    assinar("esc-a", segundo);

    const publicado = evento("esc-a");
    eventosCampanha.publicar(publicado);

    expect(primeiro).toHaveBeenCalledWith(publicado);
    expect(segundo).toHaveBeenCalledWith(publicado);
  });

  // RN19: o barramento é o primeiro ponto de isolamento do tempo real.
  it("ouvinte do escritório A não recebe evento do escritório B", () => {
    const deA = jest.fn();
    const deB = jest.fn();
    assinar("esc-a", deA);
    assinar("esc-b", deB);

    eventosCampanha.publicar(evento("esc-b"));

    expect(deA).not.toHaveBeenCalled();
    expect(deB).toHaveBeenCalledTimes(1);
  });

  it("campanha.removida também só chega ao escritório da campanha", () => {
    const deA = jest.fn();
    const deB = jest.fn();
    assinar("esc-a", deA);
    assinar("esc-b", deB);

    const removida: EventoCampanha = {
      tipo: "campanha.removida",
      escritorioId: "esc-a",
      campanhaId: "campanha-1",
    };
    eventosCampanha.publicar(removida);

    expect(deA).toHaveBeenCalledWith(removida);
    expect(deB).not.toHaveBeenCalled();
  });

  it("o cancelamento para de entregar só para aquele ouvinte", () => {
    const cancelado = jest.fn();
    const ativo = jest.fn();
    const cancelar = eventosCampanha.assinar("esc-a", cancelado);
    assinar("esc-a", ativo);

    cancelar();
    eventosCampanha.publicar(evento("esc-a"));

    expect(cancelado).not.toHaveBeenCalled();
    expect(ativo).toHaveBeenCalledTimes(1);
  });

  it("cancelar duas vezes não tem efeito colateral", () => {
    const ouvinte = jest.fn();
    const cancelar = eventosCampanha.assinar("esc-a", ouvinte);

    cancelar();
    expect(() => cancelar()).not.toThrow();
    eventosCampanha.publicar(evento("esc-a"));

    expect(ouvinte).not.toHaveBeenCalled();
  });

  it("um ouvinte que lança não impede a entrega aos próximos nem quebra quem publica", () => {
    const erro = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const quebrado = jest.fn(() => {
      throw new Error("socket fechado");
    });
    const proximo = jest.fn();
    assinar("esc-a", quebrado);
    assinar("esc-a", proximo);

    expect(() => eventosCampanha.publicar(evento("esc-a"))).not.toThrow();

    expect(quebrado).toHaveBeenCalledTimes(1);
    expect(proximo).toHaveBeenCalledTimes(1);
    erro.mockRestore();
  });

  it("publicar sem ouvintes não faz nada", () => {
    expect(() => eventosCampanha.publicar(evento("esc-sem-ouvinte"))).not.toThrow();
  });
});
