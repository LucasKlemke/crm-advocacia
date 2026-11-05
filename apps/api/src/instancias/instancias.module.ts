import { Module } from "@nestjs/common";
import { InstanciasController } from "./instancias.controller";
import { INSTANCIAS_SERVICE } from "./tokens";
import { instanciaWhatsappService } from "@/services/instancia-whatsapp.service";

@Module({
  controllers: [InstanciasController],
  providers: [{ provide: INSTANCIAS_SERVICE, useValue: instanciaWhatsappService }],
})
export class InstanciasModule {}
