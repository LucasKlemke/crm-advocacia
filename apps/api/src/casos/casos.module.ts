import { Module } from "@nestjs/common";
import { CasosController } from "./casos.controller";
import { CASO_SERVICE, PAYLOADS_CASO, type PayloadsCaso } from "./tokens";
import { DOCUMENTO_SERVICE, ZIP_DOCUMENTOS } from "../comum/tokens-documentos";
import { casoService } from "@dominio/services/caso.service";
import { documentoService } from "@dominio/services/documento.service";
import { montarZipDocumentos } from "@dominio/lib/documentos/zip";
import { montarListaCasos } from "@dominio/lib/api/payloads/casos-lista";
import { montarOpcoesFiltroCaso } from "@dominio/lib/api/payloads/casos-filtros";

const payloads: PayloadsCaso = { montarListaCasos, montarOpcoesFiltroCaso };

@Module({
  controllers: [CasosController],
  providers: [
    { provide: CASO_SERVICE, useValue: casoService },
    { provide: PAYLOADS_CASO, useValue: payloads },
    { provide: DOCUMENTO_SERVICE, useValue: documentoService },
    { provide: ZIP_DOCUMENTOS, useValue: montarZipDocumentos },
  ],
})
export class CasosModule {}
