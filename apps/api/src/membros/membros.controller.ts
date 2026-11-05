import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import type { RoleMembro } from "@prisma/client";
import { TenantGuard } from "../comum/tenant/tenant.guard";
import { Tenant } from "../comum/tenant/tenant.decorator";
import { ErrosHttpFilter } from "../comum/erros-http.filter";
import { ValidacaoZodPipe } from "../comum/validacao.pipe";
import { MEMBRO_SERVICE, USUARIO_SERVICE_AVATAR } from "./tokens";
import { tratarErroDeMembro } from "./erros";
import { alterarRoleSchema } from "@dominio/lib/api/schemas-membro";
import type { membroService } from "@dominio/services/membro.service";
import type { usuarioService } from "@dominio/services/usuario.service";
import type { TenantContext } from "@dominio/lib/auth/resolver-tenant";

// Gestão de usuários do escritório (RN02a): as regras de quem pode promover/remover
// ficam no membroService.
@Controller("membros")
@UseGuards(TenantGuard)
@UseFilters(new ErrosHttpFilter([tratarErroDeMembro]))
export class MembrosController {
  constructor(
    @Inject(MEMBRO_SERVICE) private readonly service: typeof membroService,
    @Inject(USUARIO_SERVICE_AVATAR)
    private readonly avatares: Pick<typeof usuarioService, "assinarUrlAvatar">,
  ) {}

  // A chave do S3 nunca sai crua: a tabela de membros usa a URL como <img src>.
  @Get()
  async listar(@Tenant() ctx: TenantContext) {
    const membros = await this.service.listarMembros(ctx);
    return {
      membros: await Promise.all(
        membros.map(async (membro) => ({
          ...membro,
          usuario: {
            ...membro.usuario,
            avatarUrl: await this.avatares.assinarUrlAvatar(
              membro.usuario.avatarUrl,
            ),
          },
        })),
      ),
    };
  }

  @Patch(":id")
  async alterarRole(
    @Tenant() ctx: TenantContext,
    @Param("id") id: string,
    @Body(new ValidacaoZodPipe(alterarRoleSchema)) dados: { role: RoleMembro },
  ) {
    return { membro: await this.service.alterarRole(ctx, id, dados.role) };
  }

  @Delete(":id")
  @HttpCode(200)
  async remover(@Tenant() ctx: TenantContext, @Param("id") id: string) {
    await this.service.remover(ctx, id);
    return { ok: true };
  }
}
