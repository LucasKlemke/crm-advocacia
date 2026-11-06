import {
  Controller,
  Get,
  Header,
  Inject,
  Injectable,
  NotFoundException,
  UseGuards,
  type CanActivate,
} from "@nestjs/common";
import { TenantGuard } from "../comum/tenant/tenant.guard";
import { Tenant } from "../comum/tenant/tenant.decorator";
import type { TenantContext } from "@dominio/lib/auth/resolver-tenant";
import { assinarTicketWs } from "@dominio/lib/auth/sessao-jwt";
import type { ConfigTempoReal } from "./config-tempo-real";
import { CONFIG_TEMPO_REAL } from "./tokens";

// Roda antes do TenantGuard: com o tempo real desligado a rota responde 404 para
// qualquer um, como se não existisse.
@Injectable()
export class TempoRealHabilitadoGuard implements CanActivate {
  constructor(@Inject(CONFIG_TEMPO_REAL) private readonly config: ConfigTempoReal) {}

  canActivate(): boolean {
    if (!this.config.habilitado) throw new NotFoundException();
    return true;
  }
}

@Controller("tempo-real")
@UseGuards(TempoRealHabilitadoGuard, TenantGuard)
export class TempoRealController {
  // Ticket de uso único (60 s) para abrir o WebSocket /api/ws: o socket fica preso ao
  // usuário e ao escritório ativo desta sessão (RN19).
  @Get("ticket")
  @Header("Cache-Control", "no-store")
  async ticket(@Tenant() ctx: TenantContext): Promise<{ ticket: string }> {
    const { ticket } = await assinarTicketWs({ sub: ctx.usuarioId, escritorioId: ctx.escritorioId });
    return { ticket };
  }
}
