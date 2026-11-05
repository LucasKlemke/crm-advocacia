import { Module } from "@nestjs/common";
import { ClientesController } from "./clientes.controller";
import { CLIENTE_SERVICE } from "./tokens";
import { DOCUMENTO_SERVICE, ZIP_DOCUMENTOS } from "../comum/tokens-documentos";
import { clienteService } from "@/services/cliente.service";
import { documentoService } from "@/services/documento.service";
import { montarZipDocumentos } from "@/lib/documentos/zip";

@Module({
  controllers: [ClientesController],
  providers: [
    { provide: CLIENTE_SERVICE, useValue: clienteService },
    { provide: DOCUMENTO_SERVICE, useValue: documentoService },
    { provide: ZIP_DOCUMENTOS, useValue: montarZipDocumentos },
  ],
})
export class ClientesModule {}
