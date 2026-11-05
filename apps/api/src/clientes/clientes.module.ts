import { Module } from "@nestjs/common";
import { ClientesController } from "./clientes.controller";
import { CLIENTE_SERVICE } from "./tokens";
import { DOCUMENTO_SERVICE, ZIP_DOCUMENTOS } from "../comum/tokens-documentos";
import { clienteService } from "@dominio/services/cliente.service";
import { documentoService } from "@dominio/services/documento.service";
import { montarZipDocumentos } from "@dominio/lib/documentos/zip";

@Module({
  controllers: [ClientesController],
  providers: [
    { provide: CLIENTE_SERVICE, useValue: clienteService },
    { provide: DOCUMENTO_SERVICE, useValue: documentoService },
    { provide: ZIP_DOCUMENTOS, useValue: montarZipDocumentos },
  ],
})
export class ClientesModule {}
