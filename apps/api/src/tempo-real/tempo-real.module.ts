import { Module } from "@nestjs/common";
import { campanhaService } from "@dominio/services/campanha.service";
import { AgendadorSincronizacao } from "./agendador-sincronizacao";
import { lerConfigTempoReal } from "./config-tempo-real";
import { AGENDADOR_SINCRONIZACAO } from "./tokens";

// Tempo real das campanhas: por ora o agendador (webhook + polling); o servidor WS entra aqui também.
@Module({
  providers: [
    {
      provide: AGENDADOR_SINCRONIZACAO,
      useFactory: () => new AgendadorSincronizacao(campanhaService, lerConfigTempoReal()),
    },
  ],
  exports: [AGENDADOR_SINCRONIZACAO],
})
export class TempoRealModule {}
