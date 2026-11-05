import { Module } from "@nestjs/common";
import { PerfilController } from "./perfil.controller";
import { PerfilLeituraController } from "./perfil-leitura.controller";
import { USUARIO_SERVICE, USUARIO_SERVICE_PERFIL } from "./tokens";
import { usuarioService } from "@dominio/services/usuario.service";

@Module({
  controllers: [PerfilController, PerfilLeituraController],
  providers: [
    { provide: USUARIO_SERVICE, useValue: usuarioService },
    { provide: USUARIO_SERVICE_PERFIL, useValue: usuarioService },
  ],
})
export class PerfilModule {}
