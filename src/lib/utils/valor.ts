const FORMATO_BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// `valor` do Caso chega do backend como Decimal serializado (string) ou número;
// null/undefined/valor não numérico viram "–" em vez de "R$ NaN".
export function formatarValorBrl(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return "–";
  const numero = typeof valor === "string" ? Number(valor) : valor;
  if (Number.isNaN(numero)) return "–";
  return FORMATO_BRL.format(numero);
}
