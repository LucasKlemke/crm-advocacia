import { Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { RESOLVEDOR_USUARIO, type ResolvedorUsuario } from "./ler-sessao";

export type RequestComUsuario = Request & { usuarioId?: string };

// Equivalente Nest do `auth()` nas rotas de perfil: só garante que há um usuário
// autenticado. Não resolve tenant — nunca use em rota que acessa dado de escritório
// (essas usam TenantGuard, RN19).
@Injectable()
export class UsuarioGuard implements CanActivate {
  constructor(@Inject(RESOLVEDOR_USUARIO) private readonly resolver: ResolvedorUsuario) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestComUsuario>();
    req.usuarioId = await this.resolver(req);
    return true;
  }
}
