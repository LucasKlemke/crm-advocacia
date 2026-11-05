import { Module } from "@nestjs/common";
import { EventosController } from "./eventos.controller";
import { EVENTO_SERVICE, SERIALIZADOR_EVENTO } from "./tokens";
import { eventoService } from "@/services/evento.service";
import { serializarEvento, serializarEventos } from "@/lib/api/serializa-evento";

@Module({
  controllers: [EventosController],
  providers: [
    { provide: EVENTO_SERVICE, useValue: eventoService },
    { provide: SERIALIZADOR_EVENTO, useValue: { serializarEvento, serializarEventos } },
  ],
})
export class EventosModule {}
