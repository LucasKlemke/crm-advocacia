import { nomeArquivoSchema } from "./comuns";

describe("nomeArquivoSchema (anti path traversal)", () => {
  it("aceita nome simples", () => {
    expect(nomeArquivoSchema.parse(" contrato.pdf ")).toBe("contrato.pdf");
  });

  it.each(["../etc/passwd", "pasta/arquivo.pdf", "pasta\\arquivo.pdf", ".oculto", ""])(
    "rejeita %p",
    (nome) => {
      expect(nomeArquivoSchema.safeParse(nome).success).toBe(false);
    }
  );
});
