import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Patch,
  Post,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import { UsuarioGuard } from "../comum/tenant/usuario.guard";
import { UsuarioId } from "../comum/tenant/usuario.decorator";
import { ErrosHttpFilter } from "../comum/erros-http.filter";
import { ValidacaoZodPipe } from "../comum/validacao.pipe";
import { falhaExterna } from "../comum/falha-externa";
import { USUARIO_SERVICE } from "./tokens";
import { tratarErroDePerfil } from "./erros";
import {
  atualizarPerfilSchema,
  alterarSenhaSchema,
  uploadUrlAvatarSchema,
  confirmarAvatarSchema,
} from "@/lib/api/schemas-perfil";
import type {
  usuarioService,
  AtualizarPerfilInput,
  UploadUrlAvatarInput,
} from "@/services/usuario.service";

// Perfil é do usuário, não do tenant: UsuarioGuard (sessão), nunca TenantGuard — o
// usuário pode estar no meio do onboarding, sem nenhum escritório ainda.
@Controller("perfil")
@UseGuards(UsuarioGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDePerfil]))
export class PerfilController {
  constructor(@Inject(USUARIO_SERVICE) private readonly service: typeof usuarioService) {}

  @Patch()
  async atualizar(
    @UsuarioId() usuarioId: string,
    @Body(new ValidacaoZodPipe(atualizarPerfilSchema)) dados: AtualizarPerfilInput
  ) {
    const usuario = await this.service.atualizarPerfil(usuarioId, dados);
    return { usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } };
  }

  @Patch("senha")
  async alterarSenha(
    @UsuarioId() usuarioId: string,
    @Body(new ValidacaoZodPipe(alterarSenhaSchema)) dados: { senhaAtual: string; novaSenha: string }
  ) {
    await this.service.alterarSenha(usuarioId, dados.senhaAtual, dados.novaSenha);
    return { ok: true };
  }

  @Post("avatar/upload-url")
  @HttpCode(200)
  @UseFilters(
    new ErrosHttpFilter([tratarErroDePerfil, falhaExterna("Não foi possível iniciar o upload.")])
  )
  async gerarUrlUploadAvatar(
    @UsuarioId() usuarioId: string,
    @Body(new ValidacaoZodPipe(uploadUrlAvatarSchema)) dados: UploadUrlAvatarInput
  ) {
    return this.service.gerarUrlUploadAvatar(usuarioId, dados);
  }

  @Post("avatar/confirmar")
  @HttpCode(200)
  async confirmarAvatar(
    @UsuarioId() usuarioId: string,
    @Body(new ValidacaoZodPipe(confirmarAvatarSchema)) dados: { storageKey: string }
  ) {
    const usuario = await this.service.confirmarUploadAvatar(usuarioId, dados.storageKey);
    return {
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        avatarUrl: usuario.avatarUrl,
      },
    };
  }

  @Get("avatar/download-url")
  @UseFilters(new ErrosHttpFilter([falhaExterna("Não foi possível gerar o link do avatar.")]))
  async gerarUrlDownloadAvatar(@UsuarioId() usuarioId: string) {
    return { downloadUrl: await this.service.gerarUrlDownloadAvatar(usuarioId) };
  }
}
