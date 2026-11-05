/** @jest-environment node */
import { z } from "zod";
import { tratarErroDeContexto, respostaDadosInvalidos } from "./erros";
import { AcessoNegadoError, NaoAutenticadoError, SemEscritorioAtivoError } from "@/lib/auth/resolver-tenant";

describe("tradutores de erro sem dependência do Next", () => {
  it.each([
    [new NaoAutenticadoError(), 401],
    [new SemEscritorioAtivoError(), 409],
    [new AcessoNegadoError(), 403],
  ])("traduz %p para %i com o corpo { error }", async (erro, status) => {
    const resposta = tratarErroDeContexto(erro);

    expect(resposta).toBeInstanceOf(Response);
    expect(resposta?.status).toBe(status);
    expect(await resposta?.json()).toEqual({ error: erro.message });
  });

  it("devolve null para erro desconhecido", () => {
    expect(tratarErroDeContexto(new Error("boom"))).toBeNull();
  });

  it("respostaDadosInvalidos devolve 400 com os detalhes por campo", async () => {
    const parse = z.object({ nome: z.string() }).safeParse({});
    const resposta = respostaDadosInvalidos(parse.success ? undefined : parse.error);

    expect(resposta).toBeInstanceOf(Response);
    expect(resposta.status).toBe(400);
    const corpo = await resposta.json();
    expect(corpo.error).toBe("Dados inválidos");
    expect(corpo.detalhes.nome).toBeDefined();
  });
});
