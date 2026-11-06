import { Module } from "@nestjs/common";
import { campanhaService } from "@dominio/services/campanha.service";
import { AgendadorSincronizacao } from "./agendador-sincronizacao";
import { lerConfigTempoReal, type ConfigTempoReal } from "./config-tempo-real";
import { TempoRealController, TempoRealHabilitadoGuard } from "./tempo-real.controller";
import { AGENDADOR_SINCRONIZACAO, CONFIG_TEMPO_REAL } from "./tokens";

// Tempo real das campanhas: agendador (webhook + polling) e o ticket do WebSocket. O
// servidor WS em si é anexado ao http.Server no main.ts (servidor-ws.ts).
@Module({
  controllers: [TempoRealController],
  providers: [
    { provide: CONFIG_TEMPO_REAL, useFactory: () => lerConfigTempoReal() },
    TempoRealHabilitadoGuard,
    {
      provide: AGENDADOR_SINCRONIZACAO,
      useFactory: (config: ConfigTempoReal) => new AgendadorSincronizacao(campanhaService, config),
      inject: [CONFIG_TEMPO_REAL],
    },
  ],
  exports: [AGENDADOR_SINCRONIZACAO, CONFIG_TEMPO_REAL],
})
export class TempoRealModule {}
