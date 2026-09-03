// Posicionamento dos blocos de evento na coluna de um dia (visões Semana/Dia). Módulo
// puro e genérico em T: trabalha só com minutos desde a meia-noite, sem conhecer
// EventoDTO — assim o algoritmo de colunas é testável com números e serve também para
// prazos ou qualquer outra faixa de tempo que a agenda venha a desenhar.
//
// A saída é toda em percentual (não em pixels) porque a altura da grade é definida no
// CSS: o componente só aplica `top`/`height`/`left`/`width` e a coluna se adapta.

export interface IntervaloMinutos {
  inicioMin: number;
  fimMin: number;
}

export interface BlocoPosicionado<T> {
  item: T;
  topoPct: number;
  alturaPct: number;
  esquerdaPct: number;
  larguraPct: number;
  coluna: number;
  totalColunas: number;
}

export interface OpcoesLayoutDia {
  minutoInicioGrade?: number;
  minutoFimGrade?: number;
  duracaoMinimaMin?: number;
}

const MINUTO_INICIO_PADRAO = 0;
const MINUTO_FIM_PADRAO = 1440;
// Abaixo disso o bloco não caberia o título nem a hora; é um piso puramente VISUAL —
// ver o comentário em calcularLayoutDia.
const DURACAO_MINIMA_PADRAO = 20;
const PASSO_PADRAO_MIN = 30;

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.min(Math.max(valor, minimo), maximo);
}

export function minutosDoDia(data: Date): number {
  return data.getHours() * 60 + data.getMinutes();
}

export function minutoParaPct(
  minuto: number,
  minutoInicioGrade: number = MINUTO_INICIO_PADRAO,
  minutoFimGrade: number = MINUTO_FIM_PADRAO
): number {
  const janela = minutoFimGrade - minutoInicioGrade;
  if (janela <= 0) return 0;
  return limitar(((minuto - minutoInicioGrade) / janela) * 100, 0, 100);
}

export interface OpcoesPctParaMinuto {
  minutoInicioGrade?: number;
  minutoFimGrade?: number;
  passoMin?: number;
}

// Caminho inverso, usado pelo clique/arraste na grade: o ponteiro dá um percentual
// contínuo, mas o horário criado precisa cair num slot redondo (30 min por padrão).
export function pctParaMinuto(pct: number, opcoes: OpcoesPctParaMinuto = {}): number {
  const {
    minutoInicioGrade = MINUTO_INICIO_PADRAO,
    minutoFimGrade = MINUTO_FIM_PADRAO,
    passoMin = PASSO_PADRAO_MIN,
  } = opcoes;

  const janela = minutoFimGrade - minutoInicioGrade;
  const bruto = minutoInicioGrade + (limitar(pct, 0, 100) / 100) * janela;
  const arredondado = passoMin > 0 ? Math.round(bruto / passoMin) * passoMin : bruto;
  return limitar(arredondado, minutoInicioGrade, minutoFimGrade);
}

// Ordem de desenho: por início; no empate o mais longo vem primeiro, para o evento que
// "abraça" os outros ficar na coluna da esquerda em vez de aparecer encavalado no meio.
function compararParaLayout(a: IntervaloMinutos, b: IntervaloMinutos): number {
  if (a.inicioMin !== b.inicioMin) return a.inicioMin - b.inicioMin;
  return b.fimMin - b.inicioMin - (a.fimMin - a.inicioMin);
}

export function calcularLayoutDia<T extends IntervaloMinutos>(
  itens: T[],
  opcoes: OpcoesLayoutDia = {}
): BlocoPosicionado<T>[] {
  const {
    minutoInicioGrade = MINUTO_INICIO_PADRAO,
    minutoFimGrade = MINUTO_FIM_PADRAO,
    duracaoMinimaMin = DURACAO_MINIMA_PADRAO,
  } = opcoes;

  // Cópia antes de ordenar: a lista vem de um resultado de query/memo do React e mutar
  // in place quebraria a igualdade referencial de quem a guardou.
  const ordenados = [...itens].sort(compararParaLayout);
  const resultado: BlocoPosicionado<T>[] = [];

  // Varredura em clusters: um item entra no cluster corrente enquanto começar antes do
  // maior fim já visto nele. `maiorFim` (e não o fim do item anterior) é o que encadeia
  // A–B–C quando C só cruza B: os três compartilham a largura, como no Google Calendar.
  let cluster: T[] = [];
  let maiorFimDoCluster = -Infinity;

  const fecharCluster = () => {
    if (cluster.length === 0) return;

    // Alocação por colunas: cada coluna guarda o fim do último item que entrou nela, e
    // o item vai para a primeira coluna já livre no seu início — assim uma coluna é
    // reaproveitada ao longo do cluster em vez de crescer indefinidamente.
    const fimPorColuna: number[] = [];
    const colunaPorItem = cluster.map((item) => {
      const livre = fimPorColuna.findIndex((fim) => fim <= item.inicioMin);
      const coluna = livre === -1 ? fimPorColuna.length : livre;
      fimPorColuna[coluna] = item.fimMin;
      return coluna;
    });

    const totalColunas = fimPorColuna.length;
    const larguraPct = 100 / totalColunas;

    cluster.forEach((item, indice) => {
      // A duração mínima entra SÓ aqui, na altura visual. Nunca no cálculo de
      // sobreposição acima: se entrasse, dois eventos de 5 min separados por 5 min
      // passariam a "colidir" e perderiam metade da largura sem se cruzarem de fato.
      const fimVisual = Math.max(item.fimMin, item.inicioMin + duracaoMinimaMin);
      const topoPct = minutoParaPct(item.inicioMin, minutoInicioGrade, minutoFimGrade);
      const coluna = colunaPorItem[indice];
      resultado.push({
        item,
        topoPct,
        alturaPct:
          minutoParaPct(fimVisual, minutoInicioGrade, minutoFimGrade) - topoPct,
        esquerdaPct: coluna * larguraPct,
        larguraPct,
        coluna,
        totalColunas,
      });
    });

    cluster = [];
    maiorFimDoCluster = -Infinity;
  };

  ordenados.forEach((item) => {
    if (cluster.length > 0 && item.inicioMin >= maiorFimDoCluster) {
      fecharCluster();
    }
    cluster.push(item);
    maiorFimDoCluster = Math.max(maiorFimDoCluster, item.fimMin);
  });
  fecharCluster();

  return resultado;
}
