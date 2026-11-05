import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { UsuarioGuard } from "../comum/tenant/usuario.guard";
import { UsuarioId } from "../comum/tenant/usuario.decorator";
import { USUARIO_SERVICE_PERFIL } from "./tokens";
import { NaoAutenticadoError } from "@dominio/lib/auth/resolver-tenant";
import type { usuarioService } from "@dominio/services/usuario.service";

// Leitura do perfil do usuário (não do tenant). Lê sempre do banco: a sessão guarda o
// nome do momento do login e o PATCH não a renova. A chave do avatar no S3 não sai
// daqui; a URL assinada continua vindo de GET /api/perfil/avatar/download-url.
@Controller("perfil")
@UseGuards(UsuarioGuard)
export class PerfilLeituraController {
  constructor(
    @Inject(USUARIO_SERVICE_PERFIL)
    private readonly usuarios: Pick<typeof usuarioService, "obterPerfil">
  ) {}

  @Get()
  async obter(@UsuarioId() usuarioId: string) {
    const perfil = await this.usuarios.obterPerfil(usuarioId);
    // Sessão válida para um usuário que não existe mais equivale a sessão inválida.
    if (!perfil) throw new NaoAutenticadoError();
    return {
      usuario: {
        id: perfil.id,
        nome: perfil.nome,
        email: perfil.email,
        temAvatar: perfil.avatarUrl != null,
      },
    };
  }
}
