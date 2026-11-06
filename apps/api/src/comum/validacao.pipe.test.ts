import { z } from "zod";
import { ValidacaoZodPipe, DadosInvalidosError } from "./validacao.pipe";

const schema = z.object({ nome: z.string().min(1, "Informe o nome") });

describe("ValidacaoZodPipe", () => {
  const pipe = new ValidacaoZodPipe(schema);

  it("devolve o dado parseado quando válido", () => {
    expect(pipe.transform({ nome: "Lead", extra: 1 })).toEqual({ nome: "Lead" });
  });

  it("lança DadosInvalidosError com o ZodError quando inválido", () => {
    const erro = (() => {
      try {
        pipe.transform({ nome: "" });
      } catch (error) {
        return error;
      }
    })();

    expect(erro).toBeInstanceOf(DadosInvalidosError);
    expect((erro as DadosInvalidosError).zodError?.flatten().fieldErrors).toEqual({
      nome: ["Informe o nome"],
    });
  });

  it("trata corpo ausente como inválido", () => {
    expect(() => pipe.transform(undefined)).toThrow(DadosInvalidosError);
  });
});
