import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { OrigemSincronizacao } from "@dominio/services/campanha.service";
import type { ConfigTempoReal } from "./config-tempo-real";

// Janela de agrupamento dos webhooks de campanha de uma instância (constante do plano).
export const DEBOUNCE_WEBHOOK_MS = 2000;
// Janela dos avisos de conexão (QR lido, desconexão): curta, porque o usuário está olhando
// para o QR esperando a tela reagir; só junta a rajada de eventos de uma mesma conexão.
export const DEBOUNCE_CONEXAO_MS = 500;

export type { OrigemSincronizacao };

// Fatia dos services que o agendador usa — permite testar sem banco nem UAZAPI.
export interface ServicoSincronizacao {
  sincronizarPeloSistema(campanhaId: string, origem: OrigemSincronizacao): Promise<boolean>;
  idsParaWebhookDaInstancia(instanciaId: string): Promise<string[]>;
  idsParaPolling(): Promise<string[]>;
  verificarStatusInstanciaPeloSistema(instanciaId: string): Promise<boolean>;
}

// Agrupa avisos por chave numa janela contada a partir do PRIMEIRO aviso (os seguintes
// dentro da janela são absorvidos). Não é um debounce "reinicia a cada chamada" de
// propósito: durante um envio em massa a UAZAPI avisa a cada poucos segundos, e um
// debounce que reinicia nunca dispararia. Rodadas da mesma chave nunca se sobrepõem: o
// aviso que chega durante uma rodada ganha nova janela ao fim dela. `executar` não pode
// rejeitar (quem o fornece loga o próprio erro).
class JanelaPorChave {
  private readonly pendentes = new Map<string, NodeJS.Timeout>();
  private readonly emAndamento = new Set<string>();
  private readonly repetirAoFim = new Set<string>();

  constructor(
    private readonly atrasoMs: number,
    private readonly executar: (chave: string) => Promise<void>,
    private readonly ativa: () => boolean
  ) {}

  agendar(chave: string): void {
    if (!this.ativa()) return;
    if (this.emAndamento.has(chave)) {
      this.repetirAoFim.add(chave);
      return;
    }
    if (this.pendentes.has(chave)) return;

    const timer = setTimeout(() => {
      this.pendentes.delete(chave);
      void this.rodar(chave);
    }, this.atrasoMs);
    timer.unref();
    this.pendentes.set(chave, timer);
  }

  limpar(): void {
    for (const timer of this.pendentes.values()) clearTimeout(timer);
    this.pendentes.clear();
    this.repetirAoFim.clear();
  }

  private async rodar(chave: string): Promise<void> {
    this.emAndamento.add(chave);
    try {
      await this.executar(chave);
    } finally {
      this.emAndamento.delete(chave);
      if (this.repetirAoFim.delete(chave)) this.agendar(chave);
    }
  }
}

// Dispara a sincronização a partir de fontes sem usuário:
// - webhook da UAZAPI de campanha (sender, messages_update): agrupado por instância numa
//   janela de 2 s; sincroniza as campanhas ativas e as concluídas recentes da instância;
// - webhook de conexão (connection): agrupado por instância numa janela curta; relê o
//   status da instância (QR lido, número, foto);
// - polling de fallback: garante progresso mesmo sem webhook (dev sem túnel, URL errada).
// Nenhum erro escapa daqui: tudo vira console.error com os ids e o laço segue. Cada
// sincronização gera uma linha de diagnóstico só com ids (nunca telefone ou texto — LGPD).
export class AgendadorSincronizacao implements OnModuleInit, OnModuleDestroy {
  private readonly janelaCampanhas: JanelaPorChave;
  private readonly janelaConexao: JanelaPorChave;
  private intervalo: NodeJS.Timeout | null = null;
  private rodadaDePollingEmAndamento = false;
  // Fila por campanha, compartilhada por webhook e polling: duas sincronizações da mesma
  // campanha nunca se sobrepõem (sem leitura duplicada da UAZAPI, log RN20 duplicado nem
  // contador antigo gravado por último); a seguinte relê depois que a anterior gravou.
  // A entrada some quando a última da fila termina.
  private readonly filasPorCampanha = new Map<string, Promise<void>>();
  // parar() é terminal (desligamento do módulo): depois dele nada agenda, inicia ou segue
  // para o próximo id.
  private parado = false;

  constructor(
    private readonly servico: ServicoSincronizacao,
    private readonly config: ConfigTempoReal
  ) {
    const ativa = () => this.config.habilitado && !this.parado;
    this.janelaCampanhas = new JanelaPorChave(
      DEBOUNCE_WEBHOOK_MS,
      (instanciaId) => this.sincronizarInstancia(instanciaId),
      ativa
    );
    this.janelaConexao = new JanelaPorChave(
      DEBOUNCE_CONEXAO_MS,
      (instanciaId) => this.verificarStatusInstancia(instanciaId),
      ativa
    );
  }

  onModuleInit(): void {
    // Em teste o polling só roda quando o próprio teste chama iniciarPolling.
    if (process.env.NODE_ENV !== "test") this.iniciarPolling();
  }

  onModuleDestroy(): void {
    this.parar();
  }

  agendarInstancia(instanciaId: string): void {
    this.janelaCampanhas.agendar(instanciaId);
  }

  agendarStatusInstancia(instanciaId: string): void {
    this.janelaConexao.agendar(instanciaId);
  }

  iniciarPolling(): void {
    if (!this.config.habilitado || this.parado || this.config.pollingMs <= 0 || this.intervalo) return;
    this.intervalo = setInterval(() => void this.rodadaDePolling(), this.config.pollingMs);
    this.intervalo.unref();
  }

  parar(): void {
    this.parado = true;
    if (this.intervalo) clearInterval(this.intervalo);
    this.intervalo = null;
    this.janelaCampanhas.limpar();
    this.janelaConexao.limpar();
  }

  private async sincronizarInstancia(instanciaId: string): Promise<void> {
    try {
      const ids = await this.servico.idsParaWebhookDaInstancia(instanciaId);
      await this.sincronizarEmSequencia(ids, "webhook", { instanciaId });
    } catch (erro) {
      console.error("[tempo-real] falha ao listar campanhas da instância", { instanciaId }, erro);
    }
  }

  private async verificarStatusInstancia(instanciaId: string): Promise<void> {
    if (this.parado) return;
    try {
      const mudou = await this.servico.verificarStatusInstanciaPeloSistema(instanciaId);
      console.log("[tempo-real] instância sincronizada", { instanciaId, mudou });
    } catch (erro) {
      console.error("[tempo-real] falha ao verificar o status da instância", { instanciaId }, erro);
    }
  }

  private async rodadaDePolling(): Promise<void> {
    if (this.rodadaDePollingEmAndamento) return;
    this.rodadaDePollingEmAndamento = true;
    try {
      const ids = await this.servico.idsParaPolling();
      await this.sincronizarEmSequencia(ids, "polling", {});
    } catch (erro) {
      console.error("[tempo-real] falha ao listar campanhas para o polling", erro);
    } finally {
      this.rodadaDePollingEmAndamento = false;
    }
  }

  // Em sequência, não em paralelo: não abre N chamadas simultâneas à UAZAPI por rodada.
  private async sincronizarEmSequencia(
    ids: string[],
    origem: OrigemSincronizacao,
    contexto: { instanciaId?: string }
  ): Promise<void> {
    for (const campanhaId of ids) {
      if (this.parado) return;
      await this.sincronizarNaFila(campanhaId, origem, contexto);
    }
  }

  // Encadeia na fila da campanha; a promessa da fila nunca rejeita (o erro é logado aqui),
  // então uma falha não trava quem vem depois.
  private async sincronizarNaFila(
    campanhaId: string,
    origem: OrigemSincronizacao,
    contexto: { instanciaId?: string }
  ): Promise<void> {
    const anterior = this.filasPorCampanha.get(campanhaId) ?? Promise.resolve();
    const atual = anterior.then(async () => {
      if (this.parado) return;
      try {
        const mudou = await this.servico.sincronizarPeloSistema(campanhaId, origem);
        console.log("[tempo-real] campanha sincronizada", { campanhaId, origem, mudou });
      } catch (erro) {
        console.error("[tempo-real] falha ao sincronizar campanha", { ...contexto, campanhaId }, erro);
      }
    });
    this.filasPorCampanha.set(campanhaId, atual);
    await atual;
    if (this.filasPorCampanha.get(campanhaId) === atual) this.filasPorCampanha.delete(campanhaId);
  }
}
