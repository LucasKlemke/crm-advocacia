import {
  calcularLayoutDia,
  minutoParaPct,
  minutosDoDia,
  pctParaMinuto,
  type IntervaloMinutos,
} from "@/lib/utils/agenda-layout";

interface Bloco extends IntervaloMinutos {
  id: string;
}

function bloco(id: string, inicioMin: number, fimMin: number): Bloco {
  return { id, inicioMin, fimMin };
}

describe("minutosDoDia", () => {
  it("conta os minutos desde a meia-noite local", () => {
    expect(minutosDoDia(new Date(2026, 8, 10, 0, 0))).toBe(0);
    expect(minutosDoDia(new Date(2026, 8, 10, 14, 30))).toBe(870);
    expect(minutosDoDia(new Date(2026, 8, 10, 23, 59))).toBe(1439);
  });
});

describe("minutoParaPct", () => {
  it("mapeia a grade padrão de 00:00 a 24:00 em 0–100%", () => {
    expect(minutoParaPct(0)).toBe(0);
    expect(minutoParaPct(720)).toBe(50);
    expect(minutoParaPct(1440)).toBe(100);
  });

  it("respeita uma grade parcial (dia comercial)", () => {
    expect(minutoParaPct(480, 480, 1200)).toBe(0);
    expect(minutoParaPct(840, 480, 1200)).toBe(50);
    expect(minutoParaPct(1200, 480, 1200)).toBe(100);
  });

  it("faz clamp fora da grade em vez de devolver percentual negativo", () => {
    expect(minutoParaPct(0, 480, 1200)).toBe(0);
    expect(minutoParaPct(1440, 480, 1200)).toBe(100);
  });
});

describe("pctParaMinuto", () => {
  it("arredonda para o passo padrão de 30 minutos", () => {
    expect(pctParaMinuto(50)).toBe(720);
    expect(pctParaMinuto(51)).toBe(720);
    expect(pctParaMinuto(53)).toBe(750);
  });

  it("aceita um passo customizado", () => {
    expect(pctParaMinuto(53, { passoMin: 15 })).toBe(765);
    expect(pctParaMinuto(53, { passoMin: 1 })).toBe(763);
  });

  it("faz clamp nos limites da grade", () => {
    expect(pctParaMinuto(-20)).toBe(0);
    expect(pctParaMinuto(140)).toBe(1440);
    expect(pctParaMinuto(100, { minutoInicioGrade: 480, minutoFimGrade: 1200 })).toBe(1200);
    expect(pctParaMinuto(0, { minutoInicioGrade: 480, minutoFimGrade: 1200 })).toBe(480);
  });

  it("é o inverso de minutoParaPct nos múltiplos do passo", () => {
    [0, 540, 720, 1080, 1440].forEach((minuto) => {
      expect(pctParaMinuto(minutoParaPct(minuto))).toBe(minuto);
    });
  });
});

describe("calcularLayoutDia", () => {
  it("devolve lista vazia para entrada vazia", () => {
    expect(calcularLayoutDia([])).toEqual([]);
  });

  it("posiciona um evento sozinho ocupando a largura toda", () => {
    const [posicionado] = calcularLayoutDia([bloco("a", 540, 660)]);
    expect(posicionado.item.id).toBe("a");
    expect(posicionado.topoPct).toBeCloseTo((540 / 1440) * 100);
    expect(posicionado.alturaPct).toBeCloseTo((120 / 1440) * 100);
    expect(posicionado.coluna).toBe(0);
    expect(posicionado.totalColunas).toBe(1);
    expect(posicionado.esquerdaPct).toBe(0);
    expect(posicionado.larguraPct).toBe(100);
  });

  it("divide dois eventos sobrepostos em duas colunas de 50%", () => {
    const layout = calcularLayoutDia([bloco("a", 540, 660), bloco("b", 600, 720)]);
    expect(layout.map((b) => b.item.id)).toEqual(["a", "b"]);
    expect(layout.every((b) => b.totalColunas === 2)).toBe(true);
    expect(layout.every((b) => b.larguraPct === 50)).toBe(true);
    expect(layout[0].coluna).toBe(0);
    expect(layout[0].esquerdaPct).toBe(0);
    expect(layout[1].coluna).toBe(1);
    expect(layout[1].esquerdaPct).toBe(50);
  });

  it("mantém eventos sequenciais em coluna única com 100% de largura", () => {
    const layout = calcularLayoutDia([
      bloco("a", 540, 600),
      bloco("b", 600, 660),
      bloco("c", 700, 760),
    ]);
    expect(layout.every((b) => b.totalColunas === 1)).toBe(true);
    expect(layout.every((b) => b.coluna === 0)).toBe(true);
    expect(layout.every((b) => b.larguraPct === 100)).toBe(true);
    expect(layout.every((b) => b.esquerdaPct === 0)).toBe(true);
  });

  it("agrupa em um único cluster quando o terceiro só sobrepõe o segundo", () => {
    // a 09:00–10:00, b 09:30–11:00, c 10:30–11:30: c não toca a, mas o cluster é
    // encadeado por b, então os três dividem o mesmo espaço — e c reaproveita a
    // coluna de a, que já terminou.
    const layout = calcularLayoutDia([
      bloco("a", 540, 600),
      bloco("b", 570, 660),
      bloco("c", 630, 690),
    ]);
    expect(layout.map((b) => b.totalColunas)).toEqual([2, 2, 2]);
    expect(layout.map((b) => b.coluna)).toEqual([0, 1, 0]);
    expect(layout.map((b) => b.larguraPct)).toEqual([50, 50, 50]);
  });

  it("separa clusters quando existe um intervalo livre entre eles", () => {
    const layout = calcularLayoutDia([
      bloco("a", 540, 600),
      bloco("b", 570, 630),
      bloco("c", 700, 760),
    ]);
    expect(layout.map((b) => b.totalColunas)).toEqual([2, 2, 1]);
    expect(layout[2].larguraPct).toBe(100);
  });

  it("ordena por início e, no empate, coloca o mais longo primeiro", () => {
    const layout = calcularLayoutDia([
      bloco("curto", 540, 570),
      bloco("longo", 540, 720),
    ]);
    expect(layout.map((b) => b.item.id)).toEqual(["longo", "curto"]);
    expect(layout[0].coluna).toBe(0);
    expect(layout[1].coluna).toBe(1);
  });

  it("aplica altura mínima a um evento curto sem criar coluna extra", () => {
    const [posicionado] = calcularLayoutDia([bloco("a", 540, 545)]);
    expect(posicionado.alturaPct).toBeCloseTo((20 / 1440) * 100);
    expect(posicionado.totalColunas).toBe(1);
    expect(posicionado.coluna).toBe(0);
  });

  it("não usa a altura mínima para decidir sobreposição", () => {
    // Dois eventos de 5 min encostados (09:00–09:05 e 09:10–09:15): a altura visual
    // de 20 min faria parecer que se cruzam, mas não se sobrepõem de fato.
    const layout = calcularLayoutDia([bloco("a", 540, 545), bloco("b", 550, 555)]);
    expect(layout.every((b) => b.totalColunas === 1)).toBe(true);
    expect(layout.every((b) => b.larguraPct === 100)).toBe(true);
  });

  it("três eventos totalmente sobrepostos viram três colunas", () => {
    const layout = calcularLayoutDia([
      bloco("a", 540, 720),
      bloco("b", 550, 720),
      bloco("c", 560, 720),
    ]);
    expect(layout.map((b) => b.totalColunas)).toEqual([3, 3, 3]);
    expect(layout.map((b) => b.coluna)).toEqual([0, 1, 2]);
    layout.forEach((b) => expect(b.larguraPct).toBeCloseTo(100 / 3));
    expect(layout[2].esquerdaPct).toBeCloseTo((2 * 100) / 3);
  });

  it("respeita uma grade parcial nas posições verticais", () => {
    const [posicionado] = calcularLayoutDia([bloco("a", 480, 540)], {
      minutoInicioGrade: 480,
      minutoFimGrade: 1200,
    });
    expect(posicionado.topoPct).toBe(0);
    expect(posicionado.alturaPct).toBeCloseTo((60 / 720) * 100);
  });

  it("aceita duração mínima customizada", () => {
    const [posicionado] = calcularLayoutDia([bloco("a", 540, 545)], { duracaoMinimaMin: 60 });
    expect(posicionado.alturaPct).toBeCloseTo((60 / 1440) * 100);
  });

  it("não muta a lista recebida", () => {
    const itens = [bloco("b", 600, 660), bloco("a", 540, 660)];
    calcularLayoutDia(itens);
    expect(itens.map((i) => i.id)).toEqual(["b", "a"]);
  });
});
