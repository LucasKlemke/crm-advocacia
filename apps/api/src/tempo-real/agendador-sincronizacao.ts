import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { ConfigTempoReal } from "./config-tempo-real";

// Janela de agrupamento dos webhooks de uma instância (constante do plano).
export const DEBOUNCE_WEBHOOK_MS = 2000;

// Fatia do campanhaService que o agendador usa — permite testar sem banco nem UAZAPI.
export interface ServicoSincronizacao {
  sincronizarPeloSistema(campanhaId: string): Promise<boolean>;
  idsAtivosDaInstancia(instanciaId: string): Promise<string[]>;
  idsParaPolling(): Promise<string[]>;
}

// Dispara a sincronização das campanhas a partir de duas fontes sem usuário:
// - webhook da UAZAPI: agrupado por instância numa janela de 2 s contada a partir do
//   primeiro aviso (os avisos seguintes dentro da janela são absorvidos). Não é um
//   debounce "reinicia a cada chamada" de propósito: durante um envio em massa a UAZAPI
//   avisa a cada poucos segundos, e um debounce que reinicia nunca dispararia;
// - polling de fallback: garante progresso mesmo sem webhook (dev sem túnel, URL errada).
// Nenhum erro escapa daqui: tudo vira console.error com os ids e o laço segue.
export class AgendadorSincronizacao implements OnModuleInit, OnModuleDestroy {
  private readonly pendentes = new Map<string, NodeJS.Timeout>();
  // Instâncias com sincronização em andamento e, entre elas, as que receberam aviso
  // durante a rodada: ganham nova janela ao fim, sem sobrepor duas rodadas da mesma instância.
  private readonly emAndamento = new Set<string>();
  private readonly repetirAoFim = new Set<string>();
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
  ) {}

  onModuleInit(): void {
    // Em teste o polling só roda quando o próprio teste chama iniciarPolling.
    if (process.env.NODE_ENV !== "test") this.iniciarPolling();
  }

  onModuleDestroy(): void {
    this.parar();
  }

  agendarInstancia(instanciaId: string): void {
    if (!this.config.habilitado || this.parado) return;
    if (this.emAndamento.has(instanciaId)) {
      this.repetirAoFim.add(instanciaId);
      return;
    }
    if (this.pendentes.has(instanciaId)) return;

    const timer = setTimeout(() => {
      this.pendentes.delete(instanciaId);
      void this.sincronizarInstancia(instanciaId);
    }, DEBOUNCE_WEBHOOK_MS);
    timer.unref();
    this.pendentes.set(instanciaId, timer);
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
    for (const timer of this.pendentes.values()) clearTimeout(timer);
    this.pendentes.clear();
    this.repetirAoFim.clear();
  }

  private async sincronizarInstancia(instanciaId: string): Promise<void> {
    this.emAndamento.add(instanciaId);
    try {
      const ids = await this.servico.idsAtivosDaInstancia(instanciaId);
      await this.sincronizarEmSequencia(ids, { instanciaId });
    } catch (erro) {
      console.error("[tempo-real] falha ao listar campanhas da instância", { instanciaId }, erro);
    } finally {
      this.emAndamento.delete(instanciaId);
      if (this.repetirAoFim.delete(instanciaId)) {
        this.agendarInstancia(instanciaId);
      }
    }
  }

  private async rodadaDePolling(): Promise<void> {
    if (this.rodadaDePollingEmAndamento) return;
    this.rodadaDePollingEmAndamento = true;
    try {
      const ids = await this.servico.idsParaPolling();
      await this.sincronizarEmSequencia(ids, {});
    } catch (erro) {
      console.error("[tempo-real] falha ao listar campanhas para o polling", erro);
    } finally {
      this.rodadaDePollingEmAndamento = false;
    }
  }

  // Em sequência, não em paralelo: não abre N chamadas simultâneas à UAZAPI por rodada.
  private async sincronizarEmSequencia(ids: string[], contexto: { instanciaId?: string }): Promise<void> {
    for (const campanhaId of ids) {
      if (this.parado) return;
      await this.sincronizarNaFila(campanhaId, contexto);
    }
  }

  // Encadeia na fila da campanha; a promessa da fila nunca rejeita (o erro é logado aqui),
  // então uma falha não trava quem vem depois.
  private async sincronizarNaFila(campanhaId: string, contexto: { instanciaId?: string }): Promise<void> {
    const anterior = this.filasPorCampanha.get(campanhaId) ?? Promise.resolve();
    const atual = anterior.then(async () => {
      if (this.parado) return;
      try {
        await this.servico.sincronizarPeloSistema(campanhaId);
      } catch (erro) {
        console.error("[tempo-real] falha ao sincronizar campanha", { ...contexto, campanhaId }, erro);
      }
    });
    this.filasPorCampanha.set(campanhaId, atual);
    await atual;
    if (this.filasPorCampanha.get(campanhaId) === atual) this.filasPorCampanha.delete(campanhaId);
  }
}
