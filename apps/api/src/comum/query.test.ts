import type { Request } from "express";
import { paginaDaQuery, searchParamsDaRequisicao } from "./query";

function req(originalUrl: string) {
  return { originalUrl } as Request;
}

describe("searchParamsDaRequisicao", () => {
  it("lê a query da URL original, decodificada", () => {
    const params = searchParamsDaRequisicao(req("/api/casos?busca=cobran%C3%A7a&statusId=a,b"));
    expect(params.get("busca")).toBe("cobrança");
    expect(params.get("statusId")).toBe("a,b");
  });

  it("devolve parâmetros vazios quando não há query", () => {
    expect(searchParamsDaRequisicao(req("/api/casos")).toString()).toBe("");
  });

  // Mesma semântica do `new URL(request.url).searchParams` das rotas Next.
  it("get() devolve o primeiro valor de parâmetro repetido e null quando ausente", () => {
    const params = searchParamsDaRequisicao(req("/api/casos?statusId=a&statusId=b"));
    expect(params.get("statusId")).toBe("a");
    expect(params.get("busca")).toBeNull();
  });
});

describe("paginaDaQuery", () => {
  it.each([
    ["", 1],
    ["pagina=3", 3],
    ["pagina=-5", 1],
    ["pagina=0", 1],
    ["pagina=abc", 1],
  ])("'%s' vira página %i", (query, esperado) => {
    expect(paginaDaQuery(new URLSearchParams(query))).toBe(esperado);
  });
});
