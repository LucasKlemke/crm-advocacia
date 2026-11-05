import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import {
  AUTORIZAR_CREDENCIAIS,
  ESCRITORIO_SERVICE,
  MEMBRO_REPOSITORY,
  MEMBRO_SERVICE,
  USUARIO_SERVICE,
} from "./tokens";
import { authorizeCredentials } from "@/lib/auth/authorize";
import { usuarioService } from "@/services/usuario.service";
import { membroRepository } from "@/repositories/membro.repository";
import { membroService } from "@/services/membro.service";
import { escritorioService } from "@/services/escritorio.service";

// Tudo que GRAVA o cookie crm_sessao mora aqui: login/logout, troca de escritório,
// cadastro e criação de escritório. Os demais módulos só leem a sessão via guards.
@Module({
  controllers: [AuthController],
  providers: [
    { provide: AUTORIZAR_CREDENCIAIS, useValue: authorizeCredentials },
    { provide: USUARIO_SERVICE, useValue: usuarioService },
    { provide: MEMBRO_REPOSITORY, useValue: membroRepository },
    { provide: MEMBRO_SERVICE, useValue: membroService },
    { provide: ESCRITORIO_SERVICE, useValue: escritorioService },
  ],
})
export class SessaoModule {}
