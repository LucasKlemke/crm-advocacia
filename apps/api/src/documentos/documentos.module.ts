import { Module } from "@nestjs/common";
import { DocumentosController } from "./documentos.controller";
import { DOCUMENTO_SERVICE } from "../comum/tokens-documentos";
import { documentoService } from "@/services/documento.service";

@Module({
  controllers: [DocumentosController],
  providers: [{ provide: DOCUMENTO_SERVICE, useValue: documentoService }],
})
export class DocumentosModule {}
