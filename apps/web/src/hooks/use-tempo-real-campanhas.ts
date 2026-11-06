import { useEffect, useSyncExternalStore } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type {
  CampanhaDTO,
  ListaCampanhas,
  RespostaCampanha,
} from "@crm/compartilhado/tipos/campanha";
import type {
  InstanciaWhatsappDTO,
  ListaInstanciasWhatsapp,
} from "@crm/compartilhado/tipos/instancia-whatsapp";
import { urlBaseWs } from "@/lib/env-ws";
import { conectarTempoReal, type EstadoTempoReal } from "@/lib/tempo-real";
import { chaveCampanhas, RAIZ_CAMPANHAS } from "./use-campanhas";
import { chaveInstanciasWhatsapp } from "./use-instancias-whatsapp";

// Status de cada mensagem vem da UAZAPI (/sender/listmessages): numa campanha enviando,
// um evento por segundo viraria uma consulta externa por segundo. No máximo uma a cada 3 s
// por campanha, e o último evento da janela nunca se perde (rodada no fim dela).
const THROTTLE_MENSAGENS_MS = 3000;
// A UAZAPI avisa (webhook) e atualiza os contadores antes de gravar o status de cada
// mensagem em /sender/listmessages, com atraso variável (em produção passou de 5 s e
// chegou perto de um minuto): a releitura imediata ainda vê o valor velho. Uma escada de
// releituras, contada do último aviso da campanha, pega o valor quando ele for gravado.
const RECONSULTAS_MENSAGENS_MS = [5_000, 15_000, 30_000, 60_000];

// Estado da conexão num store de módulo: a conexão é uma só por aba (montada no shell) e
// qualquer tela lê o estado sem precisar de provider.
let estadoAtual: EstadoTempoReal = "conectando";
const ouvintes = new Set<() => void>();

function definirEstado(estado: EstadoTempoReal) {
  if (estado === estadoAtual) return;
  estadoAtual = estado;
  ouvintes.forEach((ouvinte) => ouvinte());
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

const lerEstado = () => estadoAtual;

/** "conectado" quando o progresso das campanhas está chegando pelo WebSocket. */
export function useEstadoTempoReal(): EstadoTempoReal {
  return useSyncExternalStore(assinar, lerEstado, lerEstado);
}

const chaveDetalhes = (id: string) => [...RAIZ_CAMPANHAS, "detalhe", id] as const;
const chaveMensagens = (id: string) => [...RAIZ_CAMPANHAS, "mensagens", id] as const;

type Detalhe = RespostaCampanha & Record<string, unknown>;

function aplicarAtualizacao(queryClient: QueryClient, campanha: CampanhaDTO) {
  // Todas as páginas do detalhe em cache (a key termina na página): só a campanha muda,
  // os itens da página continuam os mesmos.
  queryClient.setQueriesData<Detalhe>({ queryKey: chaveDetalhes(campanha.id) }, (antigo) =>
    antigo ? { ...antigo, campanha: { ...antigo.campanha, ...campanha } } : antigo
  );

  const lista = queryClient.getQueryData<ListaCampanhas>(chaveCampanhas());
  if (!lista) return;
  if (lista.campanhas.some((c) => c.id === campanha.id)) {
    queryClient.setQueryData<ListaCampanhas>(chaveCampanhas(), {
      ...lista,
      campanhas: lista.campanhas.map((c) => (c.id === campanha.id ? { ...c, ...campanha } : c)),
    });
  } else {
    // Campanha criada em outra aba/por outro membro: a ordem da lista é do servidor.
    void queryClient.invalidateQueries({ queryKey: chaveCampanhas(), exact: true });
  }
}

function aplicarRemocao(queryClient: QueryClient, campanhaId: string) {
  queryClient.setQueryData<ListaCampanhas>(chaveCampanhas(), (lista) =>
    lista ? { ...lista, campanhas: lista.campanhas.filter((c) => c.id !== campanhaId) } : lista
  );
  for (const queryKey of [chaveDetalhes(campanhaId), chaveMensagens(campanhaId)]) {
    // Fora da tela, o cache simplesmente some. Com o detalhe aberto, remover deixaria o
    // observer mostrando a campanha apagada: o reset refaz a busca e a tela cai no
    // "Não foi possível carregar a campanha" do 404.
    queryClient.removeQueries({ queryKey, type: "inactive" });
    void queryClient.resetQueries({ queryKey, type: "active" });
  }
}

function aplicarInstancia(queryClient: QueryClient, instancia: InstanciaWhatsappDTO) {
  const lista = queryClient.getQueryData<ListaInstanciasWhatsapp>(chaveInstanciasWhatsapp());
  if (lista) {
    const conhecida = lista.instancias.some((i) => i.id === instancia.id);
    if (instancia.softDeletedAt !== null) {
      // /api/instancias só lista as ativas: a excluída sai da lista.
      queryClient.setQueryData<ListaInstanciasWhatsapp>(chaveInstanciasWhatsapp(), {
        ...lista,
        instancias: lista.instancias.filter((i) => i.id !== instancia.id),
      });
    } else if (conhecida) {
      queryClient.setQueryData<ListaInstanciasWhatsapp>(chaveInstanciasWhatsapp(), {
        ...lista,
        instancias: lista.instancias.map((i) => (i.id === instancia.id ? instancia : i)),
      });
    } else {
      // Criada em outra aba/por outro membro: a ordem da lista é do servidor.
      void queryClient.invalidateQueries({ queryKey: chaveInstanciasWhatsapp(), exact: true });
    }
  }
  // Lista e detalhe das campanhas mostram o status da instância que dispara.
  void queryClient.invalidateQueries({ queryKey: chaveCampanhas(), exact: true });
  void queryClient.invalidateQueries({ queryKey: [...RAIZ_CAMPANHAS, "detalhe"] });
}

/**
 * Abre o WebSocket de tempo real e mantém em dia o cache das campanhas (contadores e status
 * por mensagem) e das instâncias de WhatsApp (conexão). Montar uma vez, no shell.
 */
export function useTempoRealCampanhas(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const ultimaInvalidacao = new Map<string, number>();
    const pendentes = new Map<string, ReturnType<typeof setTimeout>>();
    const reconsultas = new Map<string, ReturnType<typeof setTimeout>[]>();

    function invalidarMensagens(campanhaId: string) {
      ultimaInvalidacao.set(campanhaId, Date.now());
      void queryClient.invalidateQueries({ queryKey: chaveMensagens(campanhaId) });
    }

    function cancelarReconsultas(campanhaId: string) {
      reconsultas.get(campanhaId)?.forEach((timer) => clearTimeout(timer));
      reconsultas.delete(campanhaId);
    }

    function agendarReconsulta(campanhaId: string) {
      cancelarReconsultas(campanhaId);
      reconsultas.set(
        campanhaId,
        RECONSULTAS_MENSAGENS_MS.map((atraso) =>
          setTimeout(() => invalidarMensagens(campanhaId), atraso)
        )
      );
    }

    function invalidarMensagensComThrottle(campanhaId: string) {
      agendarReconsulta(campanhaId);
      if (pendentes.has(campanhaId)) return;
      const decorrido = Date.now() - (ultimaInvalidacao.get(campanhaId) ?? -Infinity);
      if (decorrido >= THROTTLE_MENSAGENS_MS) {
        invalidarMensagens(campanhaId);
        return;
      }
      pendentes.set(
        campanhaId,
        setTimeout(() => {
          pendentes.delete(campanhaId);
          invalidarMensagens(campanhaId);
        }, THROTTLE_MENSAGENS_MS - decorrido)
      );
    }

    function cancelarPendente(campanhaId: string) {
      clearTimeout(pendentes.get(campanhaId));
      pendentes.delete(campanhaId);
      cancelarReconsultas(campanhaId);
    }

    const conexao = conectarTempoReal({
      base: urlBaseWs,
      aoMudarEstado: definirEstado,
      aoMensagem: (mensagem) => {
        switch (mensagem.tipo) {
          case "campanha.atualizada":
            aplicarAtualizacao(queryClient, mensagem.campanha);
            invalidarMensagensComThrottle(mensagem.campanha.id);
            break;
          case "campanha.mensagens":
            // Entregue/lida mudou na UAZAPI sem mexer nos contadores: só a tabela relê.
            invalidarMensagensComThrottle(mensagem.campanhaId);
            break;
          case "campanha.removida":
            cancelarPendente(mensagem.campanhaId);
            aplicarRemocao(queryClient, mensagem.campanhaId);
            break;
          case "instancia.atualizada":
            aplicarInstancia(queryClient, mensagem.instancia);
            break;
        }
      },
    });

    return () => {
      conexao.fechar();
      pendentes.forEach((timer) => clearTimeout(timer));
      pendentes.clear();
      reconsultas.forEach((timers) => timers.forEach((timer) => clearTimeout(timer)));
      reconsultas.clear();
      definirEstado("conectando");
    };
  }, [queryClient]);
}
