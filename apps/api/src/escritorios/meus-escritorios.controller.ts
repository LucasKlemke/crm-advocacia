import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { UsuarioGuard } from "../comum/tenant/usuario.guard";
import { UsuarioId } from "../comum/tenant/usuario.decorator";
import { MEMBRO_SERVICE_DO_USUARIO } from "./tokens";
import type { membroService } from "@dominio/services/membro.service";

// Escritórios em que o usuário da sessão é membro, para o switcher do header. Exige só
// sessão: a lista é do usuário, não de um tenant. A projeção devolve id/nome/papel (papel
// vindo do banco) e nunca os demais dados dos escritórios.
@Controller("escritorios")
@UseGuards(UsuarioGuard)
export class MeusEscritoriosController {
  constructor(
    @Inject(MEMBRO_SERVICE_DO_USUARIO)
    private readonly membros: Pick<typeof membroService, "listarEscritoriosDoUsuario">
  ) {}

  @Get()
  async listar(@UsuarioId() usuarioId: string) {
    const lista = await this.membros.listarEscritoriosDoUsuario(usuarioId);
    return {
      escritorios: lista.map(({ escritorio, role }) => ({
        id: escritorio.id,
        nome: escritorio.nome,
        role,
      })),
    };
  }
}
