import { segmentarFormatacaoWhatsapp } from "./whatsapp-formatacao";

describe("segmentarFormatacaoWhatsapp", () => {
  it("devolve o texto puro quando não há marcação", () => {
    expect(segmentarFormatacaoWhatsapp("Olá, tudo bem?")).toEqual([
      { texto: "Olá, tudo bem?", estilos: [] },
    ]);
  });

  it("reconhece *negrito*", () => {
    expect(segmentarFormatacaoWhatsapp("Olá *Ana*!")).toEqual([
      { texto: "Olá ", estilos: [] },
      { texto: "Ana", estilos: ["negrito"] },
      { texto: "!", estilos: [] },
    ]);
  });

  it("reconhece _itálico_, ~riscado~ e ```mono```", () => {
    expect(segmentarFormatacaoWhatsapp("_a_ ~b~ ```c```")).toEqual([
      { texto: "a", estilos: ["italico"] },
      { texto: " ", estilos: [] },
      { texto: "b", estilos: ["riscado"] },
      { texto: " ", estilos: [] },
      { texto: "c", estilos: ["mono"] },
    ]);
  });

  it("combina marcações aninhadas", () => {
    expect(segmentarFormatacaoWhatsapp("*_ambos_*")).toEqual([
      { texto: "ambos", estilos: ["negrito", "italico"] },
    ]);
  });

  // O WhatsApp não formata marcador sem par: o asterisco solto aparece literal.
  it("mantém literal o marcador sem fechamento", () => {
    expect(segmentarFormatacaoWhatsapp("2 * 3 = 6")).toEqual([{ texto: "2 * 3 = 6", estilos: [] }]);
  });

  it("não formata marcador com conteúdo vazio", () => {
    expect(segmentarFormatacaoWhatsapp("** vazio")).toEqual([{ texto: "** vazio", estilos: [] }]);
  });

  it("preserva quebras de linha", () => {
    expect(segmentarFormatacaoWhatsapp("linha 1\nlinha 2")).toEqual([
      { texto: "linha 1\nlinha 2", estilos: [] },
    ]);
  });

  it("devolve lista vazia para texto vazio", () => {
    expect(segmentarFormatacaoWhatsapp("")).toEqual([]);
  });
});
