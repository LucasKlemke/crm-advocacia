import { clienteRepository } from "@/repositories/cliente.repository";
import { membroRepository } from "@/repositories/membro.repository";
import { statusRepository } from "@/repositories/status.repository";
import { tipoStatusRepository } from "@/repositories/tipo-status.repository";
import { usuarioService } from "@/services/usuario.service";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { FiltrosCasoOpcoes } from "@/types/caso";

// Payload único para as opções dos filtros de /casos e do dashboard (dropdowns de
// cliente, responsável, status e tipo) — evita 4 requisições separadas na tela.
// Extraído do route handler para ser reusado pelo prefetch no servidor.
export async function montarOpcoesFiltroCaso(ctx: TenantContext): Promise<FiltrosCasoOpcoes> {
  const [clientes, membros, status, tipos] = await Promise.all([
    clienteRepository.listar(ctx.escritorioId),
    membroRepository.listarComUsuarioPorEscritorio(ctx.escritorioId),
    statusRepository.listar(ctx.escritorioId),
    tipoStatusRepository.listar(),
  ]);

  const membrosComAvatar = await Promise.all(
    membros.map(async (m) => ({
      id: m.id,
      nome: m.usuario.nome,
      avatarUrl: await usuarioService.assinarUrlAvatar(m.usuario.avatarUrl),
    }))
  );

  return {
    clientes: clientes.map((c) => ({ id: c.id, nome: c.nome, cpf: c.cpf })),
    membros: membrosComAvatar,
    status: status.map((s) => ({ id: s.id, nome: s.nome, cor: s.cor, descricao: s.descricao })),
    tipos: tipos.map((t) => ({
      id: t.id,
      nome: t.nome,
      chave: t.chave,
      cor: t.cor,
      descricao: t.descricao,
    })),
  };
}
