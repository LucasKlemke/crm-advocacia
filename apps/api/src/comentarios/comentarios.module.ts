import { Module } from "@nestjs/common";
import { ComentariosController } from "./comentarios.controller";
import { COMENTARIO_SERVICE, USUARIO_SERVICE } from "./tokens";
import { comentarioService } from "@/services/comentario.service";
import { usuarioService } from "@/services/usuario.service";

@Module({
  controllers: [ComentariosController],
  providers: [
    { provide: COMENTARIO_SERVICE, useValue: comentarioService },
    { provide: USUARIO_SERVICE, useValue: usuarioService },
  ],
})
export class ComentariosModule {}
