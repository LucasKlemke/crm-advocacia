import { AgendadorSincronizacao, DEBOUNCE_WEBHOOK_MS, type ServicoSincronizacao } from "./agendador-sincronizacao";
import type { ConfigTempoReal } from "./config-tempo-real";

const CONFIG: ConfigTempoReal = { habilitado: true, pollingMs: 15000, origensWeb: [] };

function criarServico(): jest.Mocked<ServicoSincronizacao> {
  return {
    sincronizarPeloSistema: jest.fn().mockResolvedValue(true),
    idsAtivosDaInstancia: jest.fn().mockResolvedValue([]),
    idsParaPolling: jest.fn().mockResolvedValue([]),
  };
}

// Promessa controlada de fora: segura uma rodada "em andamento" para testar reentrância.
function adiada<T>() {
  let resolver!: (valor: T) => void;
  const promessa = new Promise<T>((r) => (resolver = r));
  return { promessa, resolver };
}

describe("AgendadorSincronizacao", () => {
  let servico: jest.Mocked<ServicoSincronizacao>;
  let agendador: AgendadorSincronizacao;
  let erroSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    servico = criarServico();
    erroSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    agendador?.parar();
    erroSpy.mockRestore();
    jest.useRealTimers();
  });

  describe("agendarInstancia (debounce do webhook)", () => {
    it("o debounce é de 2000 ms", () => {
      expect(DEBOUNCE_WEBHOOK_MS).toBe(2000);
    });

    it("50 chamadas em 1 s viram uma única busca de ids e um sync por campanha após 2000 ms", async () => {
      servico.idsAtivosDaInstancia.mockResolvedValue(["camp-1", "camp-2"]);
      agendador = new AgendadorSincronizacao(servico, CONFIG);

      for (let i = 0; i < 50; i++) {
        agendador.agendarInstancia("inst-1");
        await jest.advanceTimersByTimeAsync(20);
      }
      // 1000 ms depois da primeira chamada: nada ainda.
      expect(servico.idsAtivosDaInstancia).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(DEBOUNCE_WEBHOOK_MS);

      expect(servico.idsAtivosDaInstancia).toHaveBeenCalledTimes(1);
      expect(servico.idsAtivosDaInstancia).toHaveBeenCalledWith("inst-1");
      expect(servico.sincronizarPeloSistema).toHaveBeenCalledTimes(2);
      expect(servico.sincronizarPeloSistema).toHaveBeenNthCalledWith(1, "camp-1");
      expect(servico.sincronizarPeloSistema).toHaveBeenNthCalledWith(2, "camp-2");
    });

    it("rajada contínua não adia a sincronização para sempre: no máximo uma a cada 2000 ms", async () => {
      agendador = new AgendadorSincronizacao(servico, CONFIG);

      // 5 s de webhooks a cada 100 ms.
      for (let i = 0; i < 50; i++) {
        agendador.agendarInstancia("inst-1");
        await jest.advanceTimersByTimeAsync(100);
      }

      expect(servico.idsAtivosDaInstancia).toHaveBeenCalledTimes(2);
    });

    it("instâncias diferentes têm janelas independentes e não se atrasam", async () => {
      agendador = new AgendadorSincronizacao(servico, CONFIG);

      agendador.agendarInstancia("inst-1");
      await jest.advanceTimersByTimeAsync(1500);
      agendador.agendarInstancia("inst-2");
      await jest.advanceTimersByTimeAsync(500);

      expect(servico.idsAtivosDaInstancia).toHaveBeenCalledTimes(1);
      expect(servico.idsAtivosDaInstancia).toHaveBeenCalledWith("inst-1");

      await jest.advanceTimersByTimeAsync(1500);
      expect(servico.idsAtivosDaInstancia).toHaveBeenCalledTimes(2);
      expect(servico.idsAtivosDaInstancia).toHaveBeenLastCalledWith("inst-2");
    });

    it("falha da UAZAPI numa campanha é logada com os ids e não impede a próxima", async () => {
      servico.idsAtivosDaInstancia.mockResolvedValue(["camp-1", "camp-2"]);
      servico.sincronizarPeloSistema.mockRejectedValueOnce(new Error("UAZAPI fora do ar"));
      agendador = new AgendadorSincronizacao(servico, CONFIG);

      agendador.agendarInstancia("inst-1");
      await jest.advanceTimersByTimeAsync(DEBOUNCE_WEBHOOK_MS);

      expect(servico.sincronizarPeloSistema).toHaveBeenCalledTimes(2);
      expect(erroSpy).toHaveBeenCalledWith(
        expect.stringContaining("[tempo-real]"),
        expect.objectContaining({ instanciaId: "inst-1", campanhaId: "camp-1" }),
        expect.any(Error)
      );
    });

    it("falha ao listar as campanhas da instância é logada, sem rejeição solta", async () => {
      servico.idsAtivosDaInstancia.mockRejectedValue(new Error("banco fora"));
      agendador = new AgendadorSincronizacao(servico, CONFIG);

      agendador.agendarInstancia("inst-1");
      await jest.advanceTimersByTimeAsync(DEBOUNCE_WEBHOOK_MS);

      expect(servico.sincronizarPeloSistema).not.toHaveBeenCalled();
      expect(erroSpy).toHaveBeenCalledWith(
        expect.stringContaining("[tempo-real]"),
        expect.objectContaining({ instanciaId: "inst-1" }),
        expect.any(Error)
      );
    });

    it("webhook que chega durante a sincronização da mesma instância ganha nova janela ao fim, sem sobrepor", async () => {
      const segura = adiada<string[]>();
      servico.idsAtivosDaInstancia.mockReturnValueOnce(segura.promessa).mockResolvedValue([]);
      agendador = new AgendadorSincronizacao(servico, CONFIG);

      agendador.agendarInstancia("inst-1");
      await jest.advanceTimersByTimeAsync(DEBOUNCE_WEBHOOK_MS);
      expect(servico.idsAtivosDaInstancia).toHaveBeenCalledTimes(1);

      // Novo webhook enquanto a primeira rodada ainda está em andamento.
      agendador.agendarInstancia("inst-1");
      await jest.advanceTimersByTimeAsync(DEBOUNCE_WEBHOOK_MS * 3);
      expect(servico.idsAtivosDaInstancia).toHaveBeenCalledTimes(1);

      segura.resolver([]);
      await jest.advanceTimersByTimeAsync(DEBOUNCE_WEBHOOK_MS - 1);
      expect(servico.idsAtivosDaInstancia).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      expect(servico.idsAtivosDaInstancia).toHaveBeenCalledTimes(2);
    });

    it("parar() cancela as sincronizações pendentes", async () => {
      agendador = new AgendadorSincronizacao(servico, CONFIG);

      agendador.agendarInstancia("inst-1");
      agendador.agendarInstancia("inst-2");
      agendador.parar();
      await jest.advanceTimersByTimeAsync(DEBOUNCE_WEBHOOK_MS * 2);

      expect(servico.idsAtivosDaInstancia).not.toHaveBeenCalled();
    });

    it("desabilitado: agendar não faz nada", async () => {
      agendador = new AgendadorSincronizacao(servico, { ...CONFIG, habilitado: false });

      agendador.agendarInstancia("inst-1");
      await jest.advanceTimersByTimeAsync(DEBOUNCE_WEBHOOK_MS * 2);

      expect(servico.idsAtivosDaInstancia).not.toHaveBeenCalled();
    });
  });

  describe("polling de fallback", () => {
    it("chama idsParaPolling a cada pollingMs e sincroniza os ids em sequência", async () => {
      servico.idsParaPolling.mockResolvedValue(["camp-1", "camp-2"]);
      const ordem: string[] = [];
      servico.sincronizarPeloSistema.mockImplementation(async (id) => {
        ordem.push(`inicio:${id}`);
        await Promise.resolve();
        ordem.push(`fim:${id}`);
        return true;
      });
      agendador = new AgendadorSincronizacao(servico, CONFIG);

      agendador.iniciarPolling();
      await jest.advanceTimersByTimeAsync(14999);
      expect(servico.idsParaPolling).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1);
      expect(servico.idsParaPolling).toHaveBeenCalledTimes(1);
      expect(ordem).toEqual(["inicio:camp-1", "fim:camp-1", "inicio:camp-2", "fim:camp-2"]);

      await jest.advanceTimersByTimeAsync(15000);
      expect(servico.idsParaPolling).toHaveBeenCalledTimes(2);
    });

    it("não reentra enquanto a rodada anterior não terminou", async () => {
      const segura = adiada<boolean>();
      servico.idsParaPolling.mockResolvedValue(["camp-1"]);
      servico.sincronizarPeloSistema.mockReturnValueOnce(segura.promessa);
      agendador = new AgendadorSincronizacao(servico, CONFIG);

      agendador.iniciarPolling();
      await jest.advanceTimersByTimeAsync(15000 * 3);
      expect(servico.idsParaPolling).toHaveBeenCalledTimes(1);

      segura.resolver(false);
      await jest.advanceTimersByTimeAsync(15000);
      expect(servico.idsParaPolling).toHaveBeenCalledTimes(2);
    });

    it("falha numa campanha não impede a próxima nem a próxima rodada", async () => {
      servico.idsParaPolling.mockResolvedValue(["camp-1", "camp-2"]);
      servico.sincronizarPeloSistema.mockRejectedValueOnce(new Error("UAZAPI fora do ar"));
      agendador = new AgendadorSincronizacao(servico, CONFIG);

      agendador.iniciarPolling();
      await jest.advanceTimersByTimeAsync(15000);
      expect(servico.sincronizarPeloSistema).toHaveBeenCalledTimes(2);
      expect(erroSpy).toHaveBeenCalledWith(
        expect.stringContaining("[tempo-real]"),
        expect.objectContaining({ campanhaId: "camp-1" }),
        expect.any(Error)
      );

      await jest.advanceTimersByTimeAsync(15000);
      expect(servico.sincronizarPeloSistema).toHaveBeenCalledTimes(4);
    });

    it("falha ao listar os ids é logada e a próxima rodada acontece", async () => {
      servico.idsParaPolling.mockRejectedValueOnce(new Error("banco fora")).mockResolvedValue([]);
      agendador = new AgendadorSincronizacao(servico, CONFIG);

      agendador.iniciarPolling();
      await jest.advanceTimersByTimeAsync(15000);
      expect(erroSpy).toHaveBeenCalledWith(expect.stringContaining("[tempo-real]"), expect.any(Error));

      await jest.advanceTimersByTimeAsync(15000);
      expect(servico.idsParaPolling).toHaveBeenCalledTimes(2);
    });

    it("iniciarPolling é idempotente: chamar duas vezes não dobra as rodadas", async () => {
      agendador = new AgendadorSincronizacao(servico, CONFIG);

      agendador.iniciarPolling();
      agendador.iniciarPolling();
      await jest.advanceTimersByTimeAsync(15000);

      expect(servico.idsParaPolling).toHaveBeenCalledTimes(1);
    });

    it("parar() interrompe o polling e a rodada em andamento não segue para o próximo id", async () => {
      const segura = adiada<boolean>();
      servico.idsParaPolling.mockResolvedValue(["camp-1", "camp-2"]);
      servico.sincronizarPeloSistema.mockReturnValueOnce(segura.promessa);
      agendador = new AgendadorSincronizacao(servico, CONFIG);

      agendador.iniciarPolling();
      await jest.advanceTimersByTimeAsync(15000);
      agendador.parar();
      segura.resolver(true);
      await jest.advanceTimersByTimeAsync(15000 * 2);

      expect(servico.idsParaPolling).toHaveBeenCalledTimes(1);
      expect(servico.sincronizarPeloSistema).toHaveBeenCalledTimes(1);
    });

    it("pollingMs = 0 desliga o polling", async () => {
      agendador = new AgendadorSincronizacao(servico, { ...CONFIG, pollingMs: 0 });

      agendador.iniciarPolling();
      await jest.advanceTimersByTimeAsync(60000);

      expect(servico.idsParaPolling).not.toHaveBeenCalled();
    });

    it("desabilitado: iniciarPolling não faz nada", async () => {
      agendador = new AgendadorSincronizacao(servico, { ...CONFIG, habilitado: false });

      agendador.iniciarPolling();
      await jest.advanceTimersByTimeAsync(60000);

      expect(servico.idsParaPolling).not.toHaveBeenCalled();
    });
  });

  describe("serialização por campanha entre webhook e polling", () => {
    it("polling segurando camp-1: a janela do webhook não sincroniza camp-1 de novo até a primeira terminar", async () => {
      const segura = adiada<boolean>();
      servico.idsParaPolling.mockResolvedValue(["camp-1"]);
      servico.idsAtivosDaInstancia.mockResolvedValue(["camp-1"]);
      servico.sincronizarPeloSistema.mockReturnValueOnce(segura.promessa).mockResolvedValue(true);
      agendador = new AgendadorSincronizacao(servico, CONFIG);

      agendador.iniciarPolling();
      await jest.advanceTimersByTimeAsync(15000);
      expect(servico.sincronizarPeloSistema).toHaveBeenCalledTimes(1);

      agendador.agendarInstancia("inst-1");
      await jest.advanceTimersByTimeAsync(DEBOUNCE_WEBHOOK_MS);
      expect(servico.idsAtivosDaInstancia).toHaveBeenCalledTimes(1);
      expect(servico.sincronizarPeloSistema).toHaveBeenCalledTimes(1);

      segura.resolver(true);
      await jest.advanceTimersByTimeAsync(0);
      expect(servico.sincronizarPeloSistema).toHaveBeenCalledTimes(2);
      expect(servico.sincronizarPeloSistema).toHaveBeenLastCalledWith("camp-1");
      // A fila da campanha é limpa quando a última sincronização termina.
      const filas = (agendador as unknown as { filasPorCampanha: Map<string, unknown> }).filasPorCampanha;
      expect(filas.size).toBe(0);
    });

    it("falha da sincronização anterior não trava a fila da campanha", async () => {
      const segura = adiada<boolean>();
      servico.idsParaPolling.mockResolvedValue(["camp-1"]);
      servico.idsAtivosDaInstancia.mockResolvedValue(["camp-1"]);
      servico.sincronizarPeloSistema.mockReturnValueOnce(segura.promessa).mockResolvedValue(true);
      agendador = new AgendadorSincronizacao(servico, CONFIG);

      agendador.iniciarPolling();
      await jest.advanceTimersByTimeAsync(15000);
      agendador.agendarInstancia("inst-1");
      await jest.advanceTimersByTimeAsync(DEBOUNCE_WEBHOOK_MS);

      // Rejeição de uma Promise criada fora do fluxo do agendador: precisa ser absorvida.
      const rejeicao = Promise.reject(new Error("UAZAPI fora do ar"));
      segura.resolver(rejeicao as unknown as boolean);
      await jest.advanceTimersByTimeAsync(0);

      expect(servico.sincronizarPeloSistema).toHaveBeenCalledTimes(2);
      expect(erroSpy).toHaveBeenCalledWith(
        expect.stringContaining("[tempo-real]"),
        expect.objectContaining({ campanhaId: "camp-1" }),
        expect.any(Error)
      );
    });

    it("campanhas diferentes não esperam uma pela outra", async () => {
      const segura = adiada<boolean>();
      servico.idsParaPolling.mockResolvedValue(["camp-1"]);
      servico.idsAtivosDaInstancia.mockResolvedValue(["camp-2"]);
      servico.sincronizarPeloSistema.mockReturnValueOnce(segura.promessa).mockResolvedValue(true);
      agendador = new AgendadorSincronizacao(servico, CONFIG);

      agendador.iniciarPolling();
      await jest.advanceTimersByTimeAsync(15000);
      agendador.agendarInstancia("inst-1");
      await jest.advanceTimersByTimeAsync(DEBOUNCE_WEBHOOK_MS);

      expect(servico.sincronizarPeloSistema).toHaveBeenCalledTimes(2);
      expect(servico.sincronizarPeloSistema).toHaveBeenLastCalledWith("camp-2");
      segura.resolver(true);
    });
  });

  describe("depois de parar()", () => {
    it("agendarInstancia e iniciarPolling viram no-op", async () => {
      agendador = new AgendadorSincronizacao(servico, CONFIG);

      agendador.parar();
      agendador.agendarInstancia("inst-1");
      agendador.iniciarPolling();
      await jest.advanceTimersByTimeAsync(60000);

      expect(servico.idsAtivosDaInstancia).not.toHaveBeenCalled();
      expect(servico.idsParaPolling).not.toHaveBeenCalled();
    });

    it("aviso recebido durante uma rodada que termina depois de parar() não reagenda", async () => {
      const segura = adiada<string[]>();
      servico.idsAtivosDaInstancia.mockReturnValueOnce(segura.promessa);
      agendador = new AgendadorSincronizacao(servico, CONFIG);

      agendador.agendarInstancia("inst-1");
      await jest.advanceTimersByTimeAsync(DEBOUNCE_WEBHOOK_MS);
      agendador.agendarInstancia("inst-1");
      agendador.parar();
      segura.resolver(["camp-1"]);
      await jest.advanceTimersByTimeAsync(DEBOUNCE_WEBHOOK_MS * 3);

      expect(servico.idsAtivosDaInstancia).toHaveBeenCalledTimes(1);
      expect(servico.sincronizarPeloSistema).not.toHaveBeenCalled();
    });
  });

  describe("ciclo de vida no Nest", () => {
    const nodeEnvOriginal = process.env.NODE_ENV;
    afterEach(() => {
      process.env.NODE_ENV = nodeEnvOriginal;
    });

    it("em NODE_ENV=test o polling não inicia sozinho", async () => {
      process.env.NODE_ENV = "test";
      agendador = new AgendadorSincronizacao(servico, CONFIG);

      agendador.onModuleInit();
      await jest.advanceTimersByTimeAsync(60000);

      expect(servico.idsParaPolling).not.toHaveBeenCalled();
    });

    it("fora de teste o polling inicia no onModuleInit e para no onModuleDestroy", async () => {
      process.env.NODE_ENV = "production";
      agendador = new AgendadorSincronizacao(servico, CONFIG);

      agendador.onModuleInit();
      await jest.advanceTimersByTimeAsync(15000);
      expect(servico.idsParaPolling).toHaveBeenCalledTimes(1);

      agendador.onModuleDestroy();
      await jest.advanceTimersByTimeAsync(60000);
      expect(servico.idsParaPolling).toHaveBeenCalledTimes(1);
    });
  });
});
