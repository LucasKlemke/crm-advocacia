import type { Request } from "express";

// As rotas Next liam a query com `new URL(request.url).searchParams`. Reusar um
// URLSearchParams (e não o req.query do Express, que vira array em parâmetro repetido e
// objeto em `a[b]=c`) mantém a semântica de `.get()` — primeiro valor, `null` quando
// ausente — que parseFiltrosCasoDaQuery e as rotas de lista assumem.
export function searchParamsDaRequisicao(req: Request): URLSearchParams {
  const inicio = req.originalUrl.indexOf("?");
  return new URLSearchParams(inicio === -1 ? "" : req.originalUrl.slice(inicio + 1));
}

// Página 1-based vinda da URL. Página inválida ou negativa vira 1 para nunca gerar
// skip negativo no banco (mesma regra das rotas Next de clientes e casos).
export function paginaDaQuery(searchParams: URLSearchParams): number {
  return Math.max(1, Number(searchParams.get("pagina") ?? "1") || 1);
}
