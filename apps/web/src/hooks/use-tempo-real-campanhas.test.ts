import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import type {
  CampanhaDTO,
  ListaCampanhas,
  RespostaCampanha,
  RespostaItensCampanha,
} from "@crm/compartilhado/tipos/campanha";
import { ApiError, SessaoExpiradaError } from "@/lib/api-client";
import { chaveCampanha, chaveCampanhas, chaveMensagensCampanha } from "./use-campanhas";
import { useEstadoTempoReal, useTempoRealCampanhas } from "./use-tempo-real-campanhas";

const apiFetchMock = jest.fn();
jest.mock("@/lib/api-client", () => ({
  ...jest.requireActual("@/lib/api-client"),
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

class WebSocketFalso {
  static instancias: WebSocketFalso[] = [];
  onmessage: ((evento: { data: unknown }) => void) | null = null;
  onclose: ((evento: { code: number }) => void) | null = null;
  fechadoCom: number | undefined;

  constructor(readonly url: string) {
    WebSocketFalso.instancias.push(this);
  }

  close(codigo = 1000) {
    this.fechadoCom = codigo;
  }

  receber(mensagem: unknown) {
    this.onmessage?.({ data: JSON.stringify(mensagem) });
  }

  fecharPeloServidor(codigo: number) {
    this.onclose?.({ code: codigo });
  }
}

const ultimoSocket = () => WebSocketFalso.instancias[WebSocketFalso.instancias.length - 1];

function campanhaFake(over: Partial<CampanhaDTO> = {}): CampanhaDTO {
  return {
    id: "c1",
    escritorioId: "esc-1",
    instanciaWhatsappId: "inst-1",
    criadoPorId: "user-1",
    nome: "Retomada",
    mensagemTemplate: "Olá",
    mapeamentoVariaveis: {},
    colunaNumero: "numero",
    arquivoCsvNome: null,
    delayMin: 3,
    delayMax: 6,
    agendadaPara: null,
    status: "enviando",
    uazapiFolderId: "folder-1",
    totalDestinatarios: 10,
    logTotal: 10,
    logSucesso: 2,
    logFalha: 0,
    logEntregue: 1,
    logLido: 0,
    logReproduzido: 0,
    sincronizadoEm: null,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
    instancia: null,
    ...over,
  };
}

type Detalhe = RespostaCampanha & RespostaItensCampanha;

function detalheFake(campanha = campanhaFake()): Detalhe {
  return { campanha, itens: [], total: 0, pagina: 1, porPagina: 50 };
}

function montar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }
  const hook = renderHook(
    () => {
      useTempoRealCampanhas();
      return useEstadoTempoReal();
    },
    { wrapper: Wrapper }
  );
  return { queryClient, ...hook };
}

// Deixa as promessas pendentes (apiFetch do ticket) resolverem dentro do act.
async function avancar(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

async function conectar() {
  const montado = montar();
  await avancar(0);
  act(() => ultimoSocket().receber({ tipo: "pronto" }));
  return montado;
}

const WebSocketOriginal = global.WebSocket;

beforeEach(() => {
  jest.useFakeTimers();
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async () => ({
    ticket: `ticket-${apiFetchMock.mock.calls.length}`,
  }));
  WebSocketFalso.instancias = [];
  global.WebSocket = WebSocketFalso as unknown as typeof WebSocket;
});

afterEach(() => {
  jest.useRealTimers();
  global.WebSocket = WebSocketOriginal;
});

describe("useTempoRealCampanhas — conexão", () => {
  it("pede um ticket e abre o socket na mesma origem; fica conectado ao receber 'pronto'", async () => {
    const { result } = montar();
    expect(result.current).toBe("conectando");

    await avancar(0);

    expect(apiFetchMock).toHaveBeenCalledWith("/api/tempo-real/ticket");
    expect(WebSocketFalso.instancias).toHaveLength(1);
    expect(ultimoSocket().url).toBe("ws://localhost/api/ws?ticket=ticket-1");
    expect(result.current).toBe("conectando");

    act(() => ultimoSocket().receber({ tipo: "pronto" }));
    expect(result.current).toBe("conectado");
  });

  it("404 no ticket: fica indisponível e nunca mais tenta", async () => {
    apiFetchMock.mockRejectedValue(new ApiError("Não encontrado", 404));
    const { result } = montar();
    await avancar(0);

    expect(result.current).toBe("indisponivel");
    await avancar(120_000);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(WebSocketFalso.instancias).toHaveLength(0);
  });

  it("sessão expirada no ticket: não insiste (o apiFetch já leva ao login)", async () => {
    apiFetchMock.mockRejectedValue(new SessaoExpiradaError());
    const { result } = montar();
    await avancar(0);

    expect(result.current).toBe("indisponivel");
    await avancar(120_000);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it("falha de rede no ticket: tenta de novo com backoff 1 s, 2 s, 4 s", async () => {
    apiFetchMock.mockRejectedValue(new ApiError("Sem rede", 0));
    const { result } = montar();
    await avancar(0);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("conectando");

    await avancar(999);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    await avancar(1);
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
    await avancar(2000);
    expect(apiFetchMock).toHaveBeenCalledTimes(3);
    await avancar(3999);
    expect(apiFetchMock).toHaveBeenCalledTimes(3);
    await avancar(1);
    expect(apiFetchMock).toHaveBeenCalledTimes(4);
  });

  it("socket fechado (servidor reiniciou): reconecta após 1000 ms com ticket novo e volta a 'conectado'", async () => {
    const { result } = await conectar();
    expect(result.current).toBe("conectado");

    act(() => ultimoSocket().fecharPeloServidor(1006));
    expect(result.current).toBe("conectando");

    await avancar(999);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    await avancar(1);
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
    expect(WebSocketFalso.instancias).toHaveLength(2);
    expect(ultimoSocket().url).toBe("ws://localhost/api/ws?ticket=ticket-2");

    act(() => ultimoSocket().receber({ tipo: "pronto" }));
    expect(result.current).toBe("conectado");
  });

  it.each([4401, 1011])("fechamento %i: reconecta com ticket novo", async (codigo) => {
    await conectar();
    act(() => ultimoSocket().fecharPeloServidor(codigo));
    await avancar(1000);
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
    expect(WebSocketFalso.instancias).toHaveLength(2);
  });

  it("fechamentos seguidos sem 'pronto' alongam o backoff", async () => {
    await conectar();
    act(() => ultimoSocket().fecharPeloServidor(4401));
    await avancar(1000);
    expect(WebSocketFalso.instancias).toHaveLength(2);
    act(() => ultimoSocket().fecharPeloServidor(4401));
    await avancar(1999);
    expect(WebSocketFalso.instancias).toHaveLength(2);
    await avancar(1);
    expect(WebSocketFalso.instancias).toHaveLength(3);
  });

  it.each([4403, 4429])("fechamento %i: para de vez e fica indisponível", async (codigo) => {
    const { result } = await conectar();
    act(() => ultimoSocket().fecharPeloServidor(codigo));

    expect(result.current).toBe("indisponivel");
    await avancar(120_000);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(WebSocketFalso.instancias).toHaveLength(1);
  });

  it("desmontar fecha o socket e não reconecta", async () => {
    const { unmount } = await conectar();
    const socket = ultimoSocket();

    unmount();

    expect(socket.fechadoCom).toBe(1000);
    act(() => socket.fecharPeloServidor(1000));
    await avancar(120_000);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it("desmontar antes do ticket chegar não abre socket", async () => {
    let resolver: (valor: { ticket: string }) => void = () => {};
    apiFetchMock.mockImplementation(
      () => new Promise((resolve) => {
        resolver = resolve;
      })
    );
    const { unmount } = montar();
    unmount();

    await act(async () => resolver({ ticket: "tarde" }));
    expect(WebSocketFalso.instancias).toHaveLength(0);
  });
});

describe("useTempoRealCampanhas — cache", () => {
  it("campanha.atualizada mescla a campanha em todas as páginas do detalhe e na lista, sem refetch", async () => {
    const { queryClient } = await conectar();
    queryClient.setQueryData(chaveCampanha("c1", 1), detalheFake());
    queryClient.setQueryData(chaveCampanha("c1", 2), { ...detalheFake(), pagina: 2 });
    queryClient.setQueryData(chaveCampanha("c2", 1), detalheFake(campanhaFake({ id: "c2" })));
    queryClient.setQueryData<ListaCampanhas>(chaveCampanhas(), {
      campanhas: [campanhaFake(), campanhaFake({ id: "c2" })],
    });
    const chamadasAntes = apiFetchMock.mock.calls.length;

    const atualizada = campanhaFake({ logSucesso: 9, status: "concluida" });
    act(() => ultimoSocket().receber({ tipo: "campanha.atualizada", campanha: atualizada }));

    expect(queryClient.getQueryData<Detalhe>(chaveCampanha("c1", 1))?.campanha).toEqual(atualizada);
    const pagina2 = queryClient.getQueryData<Detalhe>(chaveCampanha("c1", 2));
    expect(pagina2?.campanha.logSucesso).toBe(9);
    expect(pagina2?.pagina).toBe(2);
    expect(queryClient.getQueryData<Detalhe>(chaveCampanha("c2", 1))?.campanha.logSucesso).toBe(2);
    const lista = queryClient.getQueryData<ListaCampanhas>(chaveCampanhas());
    expect(lista?.campanhas.map((c) => [c.id, c.status])).toEqual([
      ["c1", "concluida"],
      ["c2", "enviando"],
    ]);
    expect(queryClient.getQueryState(chaveCampanhas())?.isInvalidated).toBe(false);
    expect(apiFetchMock).toHaveBeenCalledTimes(chamadasAntes);
  });

  it("campanha que a lista em cache não conhece invalida a lista", async () => {
    const { queryClient } = await conectar();
    queryClient.setQueryData<ListaCampanhas>(chaveCampanhas(), { campanhas: [campanhaFake()] });

    act(() =>
      ultimoSocket().receber({ tipo: "campanha.atualizada", campanha: campanhaFake({ id: "nova" }) })
    );

    expect(queryClient.getQueryState(chaveCampanhas())?.isInvalidated).toBe(true);
  });

  it("invalida as mensagens com throttle de 3000 ms por campanha (com uma rodada final)", async () => {
    const { queryClient } = await conectar();
    const espiao = jest.spyOn(queryClient, "invalidateQueries");
    const mensagensDe = (id: string) =>
      espiao.mock.calls.filter(
        ([filtro]) => JSON.stringify(filtro?.queryKey) === JSON.stringify(["campanhas", "mensagens", id])
      ).length;

    act(() => ultimoSocket().receber({ tipo: "campanha.atualizada", campanha: campanhaFake() }));
    await avancar(500);
    act(() => ultimoSocket().receber({ tipo: "campanha.atualizada", campanha: campanhaFake() }));
    act(() =>
      ultimoSocket().receber({ tipo: "campanha.atualizada", campanha: campanhaFake({ id: "c2" }) })
    );

    // Dois eventos da c1 em 1 s → uma invalidação; a c2 tem a própria janela.
    expect(mensagensDe("c1")).toBe(1);
    expect(mensagensDe("c2")).toBe(1);

    // O evento que caiu dentro da janela não se perde: vira uma rodada no fim dela.
    await avancar(2499);
    expect(mensagensDe("c1")).toBe(1);
    await avancar(1);
    expect(mensagensDe("c1")).toBe(2);
    await avancar(10_000);
    expect(mensagensDe("c1")).toBe(2);
    expect(mensagensDe("c2")).toBe(1);
  });

  it("campanha.removida tira a campanha da lista e descarta detalhe e mensagens em cache", async () => {
    const { queryClient } = await conectar();
    queryClient.setQueryData<ListaCampanhas>(chaveCampanhas(), {
      campanhas: [campanhaFake(), campanhaFake({ id: "c2" })],
    });
    queryClient.setQueryData(chaveCampanha("c1", 1), detalheFake());
    queryClient.setQueryData(chaveMensagensCampanha("c1", 1), { mensagens: [], total: 0, truncado: false });
    queryClient.setQueryData(chaveCampanha("c2", 1), detalheFake(campanhaFake({ id: "c2" })));

    act(() => ultimoSocket().receber({ tipo: "campanha.removida", campanhaId: "c1" }));

    expect(
      queryClient.getQueryData<ListaCampanhas>(chaveCampanhas())?.campanhas.map((c) => c.id)
    ).toEqual(["c2"]);
    expect(queryClient.getQueryData(chaveCampanha("c1", 1))).toBeUndefined();
    expect(queryClient.getQueryData(chaveMensagensCampanha("c1", 1))).toBeUndefined();
    expect(queryClient.getQueryData(chaveCampanha("c2", 1))).toBeDefined();
  });

  it("campanha.removida com o detalhe aberto refaz a busca (a tela cai no erro de carregamento)", async () => {
    const { queryClient } = await conectar();
    apiFetchMock.mockRejectedValue(new ApiError("Campanha não encontrada", 404));
    queryClient.setQueryData(chaveCampanha("c1", 1), detalheFake());
    // O observer faz o papel do useCampanha da tela de detalhe montada.
    const observador = new QueryObserver(queryClient, {
      queryKey: chaveCampanha("c1", 1),
      queryFn: () => apiFetchMock("/api/campanhas/c1?pagina=1"),
      staleTime: Infinity,
    });
    const cancelar = observador.subscribe(() => {});

    act(() => ultimoSocket().receber({ tipo: "campanha.removida", campanhaId: "c1" }));
    await avancar(0);

    expect(apiFetchMock).toHaveBeenCalledWith("/api/campanhas/c1?pagina=1");
    expect(observador.getCurrentResult().status).toBe("error");
    expect(observador.getCurrentResult().data).toBeUndefined();
    cancelar();
  });

  it("ignora mensagens fora do contrato", async () => {
    const { queryClient, result } = await conectar();
    queryClient.setQueryData(chaveCampanha("c1", 1), detalheFake());

    act(() => ultimoSocket().onmessage?.({ data: "lixo" }));
    act(() => ultimoSocket().receber({ tipo: "desconhecido" }));

    expect(queryClient.getQueryData<Detalhe>(chaveCampanha("c1", 1))?.campanha.logSucesso).toBe(2);
    expect(result.current).toBe("conectado");
  });
});
