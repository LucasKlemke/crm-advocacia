import { Module } from "@nestjs/common";
import { MembrosController } from "./membros.controller";
import { MEMBRO_SERVICE, USUARIO_SERVICE_AVATAR } from "./tokens";
import { membroService } from "@dominio/services/membro.service";
import { usuarioService } from "@dominio/services/usuario.service";

@Module({
  controllers: [MembrosController],
  providers: [
    { provide: MEMBRO_SERVICE, useValue: membroService },
    { provide: USUARIO_SERVICE_AVATAR, useValue: usuarioService },
  ],
})
export class MembrosModule {}
