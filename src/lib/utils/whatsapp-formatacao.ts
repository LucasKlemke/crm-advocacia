// Marcação de texto do WhatsApp (*negrito*, _itálico_, ~riscado~, ```mono```). A prévia da
// campanha precisa disso para ser fiel: o texto sai daqui com os asteriscos, e é o próprio
// WhatsApp que os transforma em negrito no aparelho do destinatário. Mostrar o texto cru na
// prévia faria o usuário achar que a formatação não funcionou.

export type EstiloWhatsapp = "negrito" | "italico" | "riscado" | "mono";

export interface SegmentoWhatsapp {
  texto: string;
  estilos: EstiloWhatsapp[];
}

const MARCADORES: { marcador: string; estilo: EstiloWhatsapp }[] = [
  // ``` antes de tudo: é o marcador mais longo e não aceita marcação aninhada.
  { marcador: "```", estilo: "mono" },
  { marcador: "*", estilo: "negrito" },
  { marcador: "_", estilo: "italico" },
  { marcador: "~", estilo: "riscado" },
];

function escaparRegex(valor: string): string {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function segmentar(texto: string, estilos: EstiloWhatsapp[]): SegmentoWhatsapp[] {
  for (const { marcador, estilo } of MARCADORES) {
    if (estilos.includes(estilo)) continue;

    const m = escaparRegex(marcador);
    // [^] em vez de . para o conteúdo poder atravessar quebra de linha, e +? para fechar no
    // primeiro par — "*a* e *b*" dá dois trechos em negrito, não um só.
    const padrao = new RegExp(`${m}([^]+?)${m}`);
    const achado = padrao.exec(texto);
    if (!achado) continue;

    const antes = texto.slice(0, achado.index);
    const depois = texto.slice(achado.index + achado[0].length);

    return [
      ...(antes ? segmentar(antes, estilos) : []),
      ...segmentar(achado[1], [...estilos, estilo]),
      ...(depois ? segmentar(depois, estilos) : []),
    ];
  }

  return texto ? [{ texto, estilos }] : [];
}

export function segmentarFormatacaoWhatsapp(texto: string): SegmentoWhatsapp[] {
  return segmentar(texto, []);
}
