import { useEffect, useSyncExternalStore } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type {
  CampanhaDTO,
  ListaCampanhas,
  RespostaCampanha,
} from "@crm/compartilhado/tipos/campanha";
import { urlBaseWs } from "@/lib/env-ws";
import { conectarTempoReal, type EstadoTempoReal } from "@/lib/tempo-real";
import { chaveCampanhas, RAIZ_CAMPANHAS } from "./use-campanhas";

// Status de cada mensagem vem da UAZAPI (/sender/listmessages): numa campanha enviando,
// um evento por segundo viraria uma consulta externa por segundo. No máximo uma a cada 3 s
// por campanha, e o último evento da janela nunca se perde (rodada no fim dela).
const THROTTLE_MENSAGENS_MS = 3000;

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

/** Abre o WebSocket de tempo real e mantém o cache das campanhas em dia. Montar uma vez, no shell. */
export function useTempoRealCampanhas(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const ultimaInvalidacao = new Map<string, number>();
    const pendentes = new Map<string, ReturnType<typeof setTimeout>>();

    function invalidarMensagens(campanhaId: string) {
      ultimaInvalidacao.set(campanhaId, Date.now());
      void queryClient.invalidateQueries({ queryKey: chaveMensagens(campanhaId) });
    }

    function invalidarMensagensComThrottle(campanhaId: string) {
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
    }

    const conexao = conectarTempoReal({
      base: urlBaseWs,
      aoMudarEstado: definirEstado,
      aoMensagem: (mensagem) => {
        if (mensagem.tipo === "campanha.atualizada") {
          aplicarAtualizacao(queryClient, mensagem.campanha);
          invalidarMensagensComThrottle(mensagem.campanha.id);
        } else {
          cancelarPendente(mensagem.campanhaId);
          aplicarRemocao(queryClient, mensagem.campanhaId);
        }
      },
    });

    return () => {
      conexao.fechar();
      pendentes.forEach((timer) => clearTimeout(timer));
      pendentes.clear();
      definirEstado("conectando");
    };
  }, [queryClient]);
}
