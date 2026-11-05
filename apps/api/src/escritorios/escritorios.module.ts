import { Module } from "@nestjs/common";
import { EscritorioAtualController } from "./escritorio-atual.controller";
import { ESCRITORIO_SERVICE } from "./tokens";
import { escritorioService } from "@/services/escritorio.service";

@Module({
  controllers: [EscritorioAtualController],
  providers: [{ provide: ESCRITORIO_SERVICE, useValue: escritorioService }],
})
export class EscritoriosModule {}
