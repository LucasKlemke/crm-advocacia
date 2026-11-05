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

const FORMATO_HORA = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function formatarHora(valor: string | Date): string {
  const data = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(data.getTime())) return "—";
  return FORMATO_HORA.format(data);
}

const FORMATO_DIA_CURTO = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
});

// Cabeçalho de um evento da agenda. Três formas, porque a informação útil muda:
// "Qui, 10 de set · 14:00 – 15:30" (mesmo dia), "Qui, 10 de set · dia inteiro", e
// "Qui, 10 de set, 14:00 → Sex, 11 de set, 09:00" quando o evento atravessa dias.
export function formatarIntervaloEvento(
  inicioBruto: string | Date,
  fimBruto: string | Date,
  diaInteiro = false
): string {
  const inicio = typeof inicioBruto === "string" ? new Date(inicioBruto) : inicioBruto;
  const fim = typeof fimBruto === "string" ? new Date(fimBruto) : fimBruto;
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) return "—";

  const diaInicio = FORMATO_DIA_CURTO.format(inicio).replace(".,", ",");
  const diaFim = FORMATO_DIA_CURTO.format(fim).replace(".,", ",");
  const mesmoDia = diaInicio === diaFim;

  if (diaInteiro) {
    return mesmoDia ? `${diaInicio} · dia inteiro` : `${diaInicio} → ${diaFim} · dia inteiro`;
  }
  if (mesmoDia) {
    return `${diaInicio} · ${formatarHora(inicio)} – ${formatarHora(fim)}`;
  }
  return `${diaInicio}, ${formatarHora(inicio)} → ${diaFim}, ${formatarHora(fim)}`;
}
