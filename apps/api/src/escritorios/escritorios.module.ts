import { Module } from "@nestjs/common";
import { EscritorioAtualController } from "./escritorio-atual.controller";
import { MeusEscritoriosController } from "./meus-escritorios.controller";
import { ESCRITORIO_SERVICE, MEMBRO_SERVICE_DO_USUARIO } from "./tokens";
import { escritorioService } from "@dominio/services/escritorio.service";
import { membroService } from "@dominio/services/membro.service";

@Module({
  controllers: [EscritorioAtualController, MeusEscritoriosController],
  providers: [
    { provide: ESCRITORIO_SERVICE, useValue: escritorioService },
    { provide: MEMBRO_SERVICE_DO_USUARIO, useValue: membroService },
  ],
})
export class EscritoriosModule {}
