const FORMATO_DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatarDataHora(valor: string | Date): string {
  const data = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(data.getTime())) return "—";
  return FORMATO_DATA_HORA.format(data);
}

const FORMATO_CURTO = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// Variante compacta para datas de contexto (criação/atualização no cabeçalho), onde
// a data por extenso rouba a atenção do que realmente importa na tela.
export function formatarDataHoraCurta(valor: string | Date): string {
  const data = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(data.getTime())) return "—";
  return FORMATO_CURTO.format(data).replace(",", "");
}

const FORMATO_EXTENSO = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Ex.: "Quinta-feira, 20 de Agosto de 2026" — usado no header do dashboard.
export function formatarDataExtensa(valor: string | Date): string {
  const data = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(data.getTime())) return "—";
  return FORMATO_EXTENSO.format(data)
    .split(" de ")
    .map(capitalizar)
    .join(" de ");
}
