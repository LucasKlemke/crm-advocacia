import { novoCasoSchema, edicaoCasoSchema, parseFiltrosCasoDaQuery } from "./schemas-caso";
import { SEM_RESPONSAVEL } from "@/repositories/caso.repository";

const CLIENTE_ID = "11111111-1111-4111-8111-111111111111";
const STATUS_ID = "22222222-2222-4222-8222-222222222222";
const MEMBRO_ID = "33333333-3333-4333-8333-333333333333";
const TIPO_PROCESSO_ID = "44444444-4444-4444-8444-444444444444";

describe("novoCasoSchema", () => {
  it("aceita um payload mínimo válido", () => {
    const parsed = novoCasoSchema.safeParse({
      tipoProcessoId: TIPO_PROCESSO_ID,
      clienteId: CLIENTE_ID,
      statusId: STATUS_ID,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejeita payload sem tipo de processo (campo obrigatório)", () => {
    const parsed = novoCasoSchema.safeParse({ clienteId: CLIENTE_ID, statusId: STATUS_ID });
    expect(parsed.success).toBe(false);
  });

  it("rejeita tipoProcessoId que não é uuid", () => {
    const parsed = novoCasoSchema.safeParse({
      tipoProcessoId: "nao-e-uuid",
      clienteId: CLIENTE_ID,
      statusId: STATUS_ID,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejeita clienteId que não é uuid", () => {
    const parsed = novoCasoSchema.safeParse({
      tipoProcessoId: TIPO_PROCESSO_ID,
      clienteId: "nao-e-uuid",
      statusId: STATUS_ID,
    });
    expect(parsed.success).toBe(false);
  });

  it("aceita valor numérico e coage string numérica", () => {
    const parsed = novoCasoSchema.safeParse({
      tipoProcessoId: TIPO_PROCESSO_ID,
      clienteId: CLIENTE_ID,
      statusId: STATUS_ID,
      valor: "1500.50",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.valor).toBe(1500.5);
    }
  });

  it("rejeita valor negativo", () => {
    const parsed = novoCasoSchema.safeParse({
      tipoProcessoId: TIPO_PROCESSO_ID,
      clienteId: CLIENTE_ID,
      statusId: STATUS_ID,
      valor: -10,
    });
    expect(parsed.success).toBe(false);
  });

  it("aceita responsavelMembroId nulo (sem responsável)", () => {
    const parsed = novoCasoSchema.safeParse({
      tipoProcessoId: TIPO_PROCESSO_ID,
      clienteId: CLIENTE_ID,
      statusId: STATUS_ID,
      responsavelMembroId: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("aceita responsavelMembroId válido", () => {
    const parsed = novoCasoSchema.safeParse({
      tipoProcessoId: TIPO_PROCESSO_ID,
      clienteId: CLIENTE_ID,
      statusId: STATUS_ID,
      responsavelMembroId: MEMBRO_ID,
    });
    expect(parsed.success).toBe(true);
  });
});

describe("edicaoCasoSchema", () => {
  it("aceita payload vazio (PATCH parcial)", () => {
    const parsed = edicaoCasoSchema.safeParse({});
    expect(parsed.success).toBe(true);
  });

  it("aceita só o campo que está mudando", () => {
    const parsed = edicaoCasoSchema.safeParse({ statusId: STATUS_ID });
    expect(parsed.success).toBe(true);
  });
});

describe("parseFiltrosCasoDaQuery", () => {
  it("lê tipoProcessoId como lista separada por vírgula", () => {
    const filtros = parseFiltrosCasoDaQuery(new URLSearchParams("tipoProcessoId=tp-1,tp-2"));
    expect(filtros.tipoProcessoIds).toEqual(["tp-1", "tp-2"]);
  });

  it("devolve filtros vazios quando não há query params", () => {
    const filtros = parseFiltrosCasoDaQuery(new URLSearchParams());
    expect(filtros).toEqual({
      busca: undefined,
      statusIds: undefined,
      tipoStatusIds: undefined,
      clienteIds: undefined,
      responsavelIds: undefined,
      dataInicio: undefined,
      dataFim: undefined,
      arquivado: false,
    });
  });

  it("faz parse de busca e listas separadas por vírgula", () => {
    const filtros = parseFiltrosCasoDaQuery(
      new URLSearchParams({
        busca: " cobrança ",
        statusId: `${STATUS_ID},outro-id`,
        clienteId: CLIENTE_ID,
      })
    );
    expect(filtros.busca).toBe("cobrança");
    expect(filtros.statusIds).toEqual([STATUS_ID, "outro-id"]);
    expect(filtros.clienteIds).toEqual([CLIENTE_ID]);
  });

  it("aceita o sentinela sem-responsavel misturado com ids reais", () => {
    const filtros = parseFiltrosCasoDaQuery(
      new URLSearchParams({ responsavelId: `${SEM_RESPONSAVEL},${MEMBRO_ID}` })
    );
    expect(filtros.responsavelIds).toEqual([SEM_RESPONSAVEL, MEMBRO_ID]);
  });

  it("faz parse de datas ISO válidas e ignora datas inválidas", () => {
    const filtros = parseFiltrosCasoDaQuery(
      new URLSearchParams({ dataInicio: "2026-01-01", dataFim: "data-invalida" })
    );
    expect(filtros.dataInicio).toEqual(new Date("2026-01-01"));
    expect(filtros.dataFim).toBeUndefined();
  });

  it("arquivado só fica true quando o valor é exatamente 'true'", () => {
    expect(parseFiltrosCasoDaQuery(new URLSearchParams({ arquivado: "true" })).arquivado).toBe(
      true
    );
    expect(parseFiltrosCasoDaQuery(new URLSearchParams({ arquivado: "1" })).arquivado).toBe(false);
  });
});
