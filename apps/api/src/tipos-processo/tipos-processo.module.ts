import { Module } from "@nestjs/common";
import { TiposProcessoController } from "./tipos-processo.controller";
import { TIPO_PROCESSO_SERVICE } from "./tokens";
import { tipoProcessoService } from "@/services/tipo-processo.service";

@Module({
  controllers: [TiposProcessoController],
  providers: [{ provide: TIPO_PROCESSO_SERVICE, useValue: tipoProcessoService }],
})
export class TiposProcessoModule {}
