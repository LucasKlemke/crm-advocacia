import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { EscritorioAtivoController } from "./escritorio-ativo.controller";
import { CadastroController } from "./cadastro.controller";
import { CriarEscritorioController } from "./criar-escritorio.controller";
import {
  AUTORIZAR_CREDENCIAIS,
  ESCRITORIO_SERVICE,
  MEMBRO_REPOSITORY,
  MEMBRO_SERVICE,
  USUARIO_SERVICE,
} from "./tokens";
import { authorizeCredentials } from "@dominio/lib/auth/authorize";
import { usuarioService } from "@dominio/services/usuario.service";
import { membroRepository } from "@dominio/repositories/membro.repository";
import { membroService } from "@dominio/services/membro.service";
import { escritorioService } from "@dominio/services/escritorio.service";

// Tudo que GRAVA o cookie crm_sessao mora aqui: login/logout, troca de escritório,
// cadastro e criação de escritório. Os demais módulos só leem a sessão via guards.
@Module({
  controllers: [AuthController, EscritorioAtivoController, CadastroController, CriarEscritorioController],
  providers: [
    { provide: AUTORIZAR_CREDENCIAIS, useValue: authorizeCredentials },
    { provide: USUARIO_SERVICE, useValue: usuarioService },
    { provide: MEMBRO_REPOSITORY, useValue: membroRepository },
    { provide: MEMBRO_SERVICE, useValue: membroService },
    { provide: ESCRITORIO_SERVICE, useValue: escritorioService },
  ],
})
export class SessaoModule {}
