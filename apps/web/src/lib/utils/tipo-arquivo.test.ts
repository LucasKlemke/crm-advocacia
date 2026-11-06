import { inferirTipoArquivo } from "./tipo-arquivo";

describe("inferirTipoArquivo", () => {
  it.each([
    ["contrato.pdf", "pdf"],
    ["contrato.PDF", "pdf"],
    ["peticao.docx", "docx"],
    ["foto.jpg", "jpg"],
    ["foto.JPG", "jpg"],
    ["foto.jpeg", "jpeg"],
    ["foto.png", "png"],
  ])("reconhece %s como %s", (nomeArquivo, tipoEsperado) => {
    expect(inferirTipoArquivo(nomeArquivo)).toBe(tipoEsperado);
  });

  it("retorna null para extensão não suportada", () => {
    expect(inferirTipoArquivo("malware.exe")).toBeNull();
  });

  it("retorna null para nome sem extensão", () => {
    expect(inferirTipoArquivo("semextensao")).toBeNull();
  });
});
