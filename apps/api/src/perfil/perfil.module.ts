import { Module } from "@nestjs/common";
import { PerfilController } from "./perfil.controller";
import { USUARIO_SERVICE } from "./tokens";
import { usuarioService } from "@/services/usuario.service";

@Module({
  controllers: [PerfilController],
  providers: [{ provide: USUARIO_SERVICE, useValue: usuarioService }],
})
export class PerfilModule {}
