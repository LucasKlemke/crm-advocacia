import { prisma } from "@/lib/prisma";
import {
  membroRepository,
  type MembroComUsuarioPublico,
} from "@/repositories/membro.repository";
import {
  podeGerenciarMembro,
  podeAtribuirRole,
  violaUltimoOwner,
  ehAutoAlvo,
} from "@/lib/auth/permissoes";
import { logService } from "@/services/log.service";
import { calcularDiff } from "@/lib/utils/diff";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { Escritorio, Membro, RoleMembro } from "@prisma/client";

export class PermissaoNegadaError extends Error {
  constructor() {
    super("Você não tem permissão para executar esta ação.");
    this.name = "PermissaoNegadaError";
  }
}

export class MembroNaoEncontradoError extends Error {
  constructor() {
    super("Membro não encontrado.");
    this.name = "MembroNaoEncontradoError";
  }
}

export class UltimoOwnerError extends Error {
  constructor() {
    super("O escritório precisa ter ao menos um owner.");
    this.name = "UltimoOwnerError";
  }
}

export interface EscritorioDoUsuario {
  escritorio: Escritorio;
  role: RoleMembro;
}

export const membroService = {
  async listarEscritoriosDoUsuario(usuarioId: string): Promise<EscritorioDoUsuario[]> {
    const memberships = await membroRepository.listarComEscritorioPorUsuario(usuarioId);
    return memberships.map((membro) => ({ escritorio: membro.escritorio, role: membro.role }));
  },

  // Só troca para um escritório onde o usuário realmente é membro (RN19).
  async trocarEscritorioAtivo(usuarioId: string, escritorioId: string): Promise<Membro> {
    const membro = await membroRepository.findByUsuarioEEscritorio(usuarioId, escritorioId);
    if (!membro) {
      throw new PermissaoNegadaError();
    }
    return membro;
  },

  // Retorna o usuário já projetado (sem senhaHash) — ver USUARIO_PUBLICO_SELECT.
  async listarMembros(ctx: TenantContext): Promise<MembroComUsuarioPublico[]> {
    return membroRepository.listarComUsuarioPorEscritorio(ctx.escritorioId);
  },

  async alterarRole(ctx: TenantContext, membroId: string, novoRole: RoleMembro): Promise<Membro> {
    const alvo = await membroRepository.findById(membroId);
    if (!alvo || alvo.escritorioId !== ctx.escritorioId) {
      throw new MembroNaoEncontradoError();
    }
    if (ehAutoAlvo(ctx.usuarioId, alvo.usuarioId)) {
      throw new PermissaoNegadaError();
    }
    if (!podeGerenciarMembro(ctx.role, alvo.role) || !podeAtribuirRole(ctx.role, novoRole)) {
      throw new PermissaoNegadaError();
    }
    if (alvo.role === novoRole) {
      return alvo;
    }

    const totalOwners = await membroRepository.contarOwners(ctx.escritorioId);
    if (violaUltimoOwner(alvo.role, totalOwners)) {
      throw new UltimoOwnerError();
    }

    const diff = calcularDiff(alvo, { role: novoRole }, ["role"] as const);

    return prisma.$transaction(async (tx) => {
      const membro = await membroRepository.atualizarRole(membroId, novoRole, tx);
      await logService.registrar(
        ctx,
        {
          acao: "atualizar",
          entidade: "membro",
          entidadeId: membro.id,
          resumo: `Papel do membro alterado para ${novoRole}`,
          dados: diff,
        },
        tx
      );
      return membro;
    });
  },

  async remover(ctx: TenantContext, membroId: string): Promise<void> {
    const alvo = await membroRepository.findById(membroId);
    if (!alvo || alvo.escritorioId !== ctx.escritorioId) {
      throw new MembroNaoEncontradoError();
    }
    if (ehAutoAlvo(ctx.usuarioId, alvo.usuarioId)) {
      throw new PermissaoNegadaError();
    }
    if (!podeGerenciarMembro(ctx.role, alvo.role)) {
      throw new PermissaoNegadaError();
    }
    const totalOwners = await membroRepository.contarOwners(ctx.escritorioId);
    if (violaUltimoOwner(alvo.role, totalOwners)) {
      throw new UltimoOwnerError();
    }

    await prisma.$transaction(async (tx) => {
      await membroRepository.remover(membroId, tx);
      await logService.registrar(
        ctx,
        {
          acao: "excluir",
          entidade: "membro",
          entidadeId: membroId,
          resumo: "Membro removido do escritório",
        },
        tx
      );
    });
  },
};
