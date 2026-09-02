import type { EventoDTO } from "@/types/evento";
import {
  agruparPorDia,
  ocupaDiaInteiroNaGrade,
  ordenarEventos,
  recortarNoDia,
  separarDiaInteiro,
} from "@/lib/utils/agenda-eventos";

// As datas do DTO são ISO em UTC, mas o teste precisa ser independente do fuso da
// máquina: monta a data em hora local e converte, exatamente como a UI faz na volta.
function iso(ano: number, mes: number, dia: number, hora = 0, minuto = 0): string {
  return new Date(ano, mes, dia, hora, minuto).toISOString();
}

function evento(parcial: Partial<EventoDTO> & { id: string }): EventoDTO {
  return {
    escritorioId: "esc-1",
    titulo: parcial.id,
    descricao: null,
    inicio: iso(2026, 8, 10, 9, 0),
    fim: iso(2026, 8, 10, 10, 0),
    diaInteiro: false,
    modalidade: "presencial",
    local: null,
    linkReuniao: null,
    clienteId: null,
    casoId: null,
    criadoPorMembroId: "membro-1",
    createdAt: iso(2026, 8, 1),
    updatedAt: iso(2026, 8, 1),
    cliente: null,
    caso: null,
    criadoPor: {
      membroId: "membro-1",
      usuario: { id: "u-1", nome: "Advogado", email: "a@a.com", avatarUrl: null },
    },
    participantes: [],
    podeEditar: true,
    ...parcial,
  };
}

const DIA_10 = new Date(2026, 8, 10);
const DIA_11 = new Date(2026, 8, 11);

describe("ocupaDiaInteiroNaGrade", () => {
  it("é verdadeiro para evento marcado como dia inteiro", () => {
    expect(ocupaDiaInteiroNaGrade(evento({ id: "a", diaInteiro: true }))).toBe(true);
  });

  it("é verdadeiro para evento com hora que atravessa mais de um dia local", () => {
    const cruzado = evento({
      id: "a",
      inicio: iso(2026, 8, 10, 22, 0),
      fim: iso(2026, 8, 11, 2, 0),
    });
    expect(ocupaDiaInteiroNaGrade(cruzado)).toBe(true);
  });

  it("é falso para evento que começa e termina no mesmo dia local", () => {
    expect(ocupaDiaInteiroNaGrade(evento({ id: "a" }))).toBe(false);
  });

  it("é falso para evento que termina exatamente à meia-noite seguinte", () => {
    // 22:00 → 00:00 é um evento de um único dia na leitura do usuário; contar o
    // instante final como "dia seguinte" jogaria ele para a faixa de topo sem motivo.
    const ateMeiaNoite = evento({
      id: "a",
      inicio: iso(2026, 8, 10, 22, 0),
      fim: iso(2026, 8, 11, 0, 0),
    });
    expect(ocupaDiaInteiroNaGrade(ateMeiaNoite)).toBe(false);
  });
});

describe("separarDiaInteiro", () => {
  it("manda dia inteiro e multi-dia para a faixa de topo e o resto para a grade", () => {
    const comHora = evento({ id: "com-hora" });
    const diaTodo = evento({ id: "dia-todo", diaInteiro: true });
    const multiDia = evento({
      id: "multi",
      inicio: iso(2026, 8, 10, 22, 0),
      fim: iso(2026, 8, 12, 2, 0),
    });

    const { diaInteiro, comHorario } = separarDiaInteiro([comHora, diaTodo, multiDia]);
    expect(diaInteiro.map((e) => e.id)).toEqual(["dia-todo", "multi"]);
    expect(comHorario.map((e) => e.id)).toEqual(["com-hora"]);
  });

  it("devolve duas listas vazias para entrada vazia", () => {
    expect(separarDiaInteiro([])).toEqual({ diaInteiro: [], comHorario: [] });
  });
});

describe("ordenarEventos", () => {
  it("ordena por início ascendente", () => {
    const ordenados = ordenarEventos([
      evento({ id: "tarde", inicio: iso(2026, 8, 10, 16, 0), fim: iso(2026, 8, 10, 17, 0) }),
      evento({ id: "manha", inicio: iso(2026, 8, 10, 8, 0), fim: iso(2026, 8, 10, 9, 0) }),
    ]);
    expect(ordenados.map((e) => e.id)).toEqual(["manha", "tarde"]);
  });

  it("no mesmo início coloca o dia inteiro primeiro", () => {
    const ordenados = ordenarEventos([
      evento({ id: "com-hora" }),
      evento({ id: "dia-todo", diaInteiro: true }),
    ]);
    expect(ordenados.map((e) => e.id)).toEqual(["dia-todo", "com-hora"]);
  });

  it("empata pelo título para a ordem ser estável entre renderizações", () => {
    const ordenados = ordenarEventos([
      evento({ id: "b", titulo: "Reunião" }),
      evento({ id: "a", titulo: "Audiência" }),
    ]);
    expect(ordenados.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("não muta a lista recebida", () => {
    const lista = [
      evento({ id: "tarde", inicio: iso(2026, 8, 10, 16, 0), fim: iso(2026, 8, 10, 17, 0) }),
      evento({ id: "manha", inicio: iso(2026, 8, 10, 8, 0), fim: iso(2026, 8, 10, 9, 0) }),
    ];
    ordenarEventos(lista);
    expect(lista.map((e) => e.id)).toEqual(["tarde", "manha"]);
  });
});

describe("agruparPorDia", () => {
  it("indexa pela chave local de cada dia pedido", () => {
    const mapa = agruparPorDia([evento({ id: "a" })], [DIA_10, DIA_11]);
    expect([...mapa.keys()]).toEqual(["2026-09-10", "2026-09-11"]);
    expect(mapa.get("2026-09-10")?.map((e) => e.id)).toEqual(["a"]);
    expect(mapa.get("2026-09-11")).toEqual([]);
  });

  it("repete um evento em todos os dias que ele atravessa", () => {
    const cruzado = evento({
      id: "cruzado",
      inicio: iso(2026, 8, 10, 22, 0),
      fim: iso(2026, 8, 11, 2, 0),
    });
    const mapa = agruparPorDia([cruzado], [DIA_10, DIA_11]);
    expect(mapa.get("2026-09-10")?.map((e) => e.id)).toEqual(["cruzado"]);
    expect(mapa.get("2026-09-11")?.map((e) => e.id)).toEqual(["cruzado"]);
  });

  it("ignora evento fora dos dias pedidos e não cria chave extra", () => {
    const fora = evento({
      id: "fora",
      inicio: iso(2026, 8, 20, 9, 0),
      fim: iso(2026, 8, 20, 10, 0),
    });
    const mapa = agruparPorDia([fora], [DIA_10, DIA_11]);
    expect(mapa.size).toBe(2);
    expect(mapa.get("2026-09-10")).toEqual([]);
    expect(mapa.has("2026-09-20")).toBe(false);
  });

  it("ordena os eventos dentro de cada dia", () => {
    const mapa = agruparPorDia(
      [
        evento({ id: "tarde", inicio: iso(2026, 8, 10, 16, 0), fim: iso(2026, 8, 10, 17, 0) }),
        evento({ id: "manha", inicio: iso(2026, 8, 10, 8, 0), fim: iso(2026, 8, 10, 9, 0) }),
      ],
      [DIA_10]
    );
    expect(mapa.get("2026-09-10")?.map((e) => e.id)).toEqual(["manha", "tarde"]);
  });
});

describe("recortarNoDia", () => {
  it("devolve os minutos locais de um evento contido no dia", () => {
    const segmento = recortarNoDia(evento({ id: "a" }), DIA_10);
    expect(segmento).not.toBeNull();
    expect(segmento?.inicioMin).toBe(540);
    expect(segmento?.fimMin).toBe(600);
    expect(segmento?.continuaAntes).toBe(false);
    expect(segmento?.continuaDepois).toBe(false);
    expect(segmento?.evento.id).toBe("a");
  });

  it("gera segmento nos dois dias quando o evento cruza a meia-noite", () => {
    const cruzado = evento({
      id: "cruzado",
      inicio: iso(2026, 8, 10, 22, 0),
      fim: iso(2026, 8, 11, 2, 0),
    });

    const primeiro = recortarNoDia(cruzado, DIA_10);
    expect(primeiro?.inicioMin).toBe(1320);
    expect(primeiro?.fimMin).toBe(1440);
    expect(primeiro?.continuaAntes).toBe(false);
    expect(primeiro?.continuaDepois).toBe(true);

    const segundo = recortarNoDia(cruzado, DIA_11);
    expect(segundo?.inicioMin).toBe(0);
    expect(segundo?.fimMin).toBe(120);
    expect(segundo?.continuaAntes).toBe(true);
    expect(segundo?.continuaDepois).toBe(false);
  });

  it("marca as duas pontas num dia inteiramente coberto", () => {
    const longo = evento({
      id: "longo",
      inicio: iso(2026, 8, 9, 10, 0),
      fim: iso(2026, 8, 12, 10, 0),
    });
    const segmento = recortarNoDia(longo, DIA_10);
    expect(segmento?.inicioMin).toBe(0);
    expect(segmento?.fimMin).toBe(1440);
    expect(segmento?.continuaAntes).toBe(true);
    expect(segmento?.continuaDepois).toBe(true);
  });

  it("devolve null quando o evento não toca o dia", () => {
    expect(recortarNoDia(evento({ id: "a" }), DIA_11)).toBeNull();
    expect(
      recortarNoDia(
        evento({ id: "b", inicio: iso(2026, 8, 1, 9, 0), fim: iso(2026, 8, 1, 10, 0) }),
        DIA_10
      )
    ).toBeNull();
  });

  it("devolve null quando o evento termina exatamente na meia-noite do dia", () => {
    const anterior = evento({
      id: "anterior",
      inicio: iso(2026, 8, 9, 22, 0),
      fim: iso(2026, 8, 10, 0, 0),
    });
    expect(recortarNoDia(anterior, DIA_10)).toBeNull();
  });

  it("ignora a hora da data de referência do dia", () => {
    const segmento = recortarNoDia(evento({ id: "a" }), new Date(2026, 8, 10, 23, 30));
    expect(segmento?.inicioMin).toBe(540);
  });

  it("devolve null para datas inválidas no DTO em vez de quebrar a grade", () => {
    expect(recortarNoDia(evento({ id: "a", inicio: "ontem" }), DIA_10)).toBeNull();
  });
});
