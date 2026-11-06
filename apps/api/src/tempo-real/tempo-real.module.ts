import { Module } from "@nestjs/common";
import { campanhaService } from "@dominio/services/campanha.service";
import { instanciaWhatsappService } from "@dominio/services/instancia-whatsapp.service";
import { AgendadorSincronizacao, type ServicoSincronizacao } from "./agendador-sincronizacao";
import { lerConfigTempoReal, type ConfigTempoReal } from "./config-tempo-real";
import { TempoRealController, TempoRealHabilitadoGuard } from "./tempo-real.controller";
import { AGENDADOR_SINCRONIZACAO, CONFIG_TEMPO_REAL } from "./tokens";

// Fatia dos services de domínio que o agendador usa (sincronizações sem usuário).
const servicoSincronizacao: ServicoSincronizacao = {
  sincronizarPeloSistema: (campanhaId, origem) =>
    campanhaService.sincronizarPeloSistema(campanhaId, origem),
  idsParaWebhookDaInstancia: (instanciaId) => campanhaService.idsParaWebhookDaInstancia(instanciaId),
  idsParaPolling: () => campanhaService.idsParaPolling(),
  verificarStatusInstanciaPeloSistema: (instanciaId) =>
    instanciaWhatsappService.verificarStatusPeloSistema(instanciaId),
};

// Tempo real das campanhas e instâncias: agendador (webhook + polling) e o ticket do WebSocket. O
// servidor WS em si é anexado ao http.Server no main.ts (servidor-ws.ts).
@Module({
  controllers: [TempoRealController],
  providers: [
    { provide: CONFIG_TEMPO_REAL, useFactory: () => lerConfigTempoReal() },
    TempoRealHabilitadoGuard,
    {
      provide: AGENDADOR_SINCRONIZACAO,
      useFactory: (config: ConfigTempoReal) => new AgendadorSincronizacao(servicoSincronizacao, config),
      inject: [CONFIG_TEMPO_REAL],
    },
  ],
  exports: [AGENDADOR_SINCRONIZACAO, CONFIG_TEMPO_REAL],
})
export class TempoRealModule {}
