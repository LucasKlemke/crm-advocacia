import { prisma } from "@/lib/prisma";
import { escritorioRepository } from "@/repositories/escritorio.repository";
import { membroRepository } from "@/repositories/membro.repository";
import { PermissaoNegadaError } from "@/services/membro.service";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { Escritorio, Membro } from "@prisma/client";

export class EscritorioNaoEncontradoError extends Error {
  constructor() {
    super("Escritório não encontrado.");
    this.name = "EscritorioNaoEncontradoError";
  }
}

export { PermissaoNegadaError };

export interface CriarEscritorioInput {
  nome: string;
  oabResponsavel?: string;
  telefoneWhatsapp?: string;
}

export interface CriarEscritorioResult {
  escritorio: Escritorio;
  membro: Membro;
}

export interface AtualizarEscritorioInput {
  nome?: string;
  oabResponsavel?: string;
  telefoneWhatsapp?: string;
}

export const escritorioService = {
  // Onboarding (primeiro escritório) ou "criar outro escritório": quem cria vira owner
  // na mesma transação (RN02).
  async criarEscritorio(
    usuarioId: string,
    dados: CriarEscritorioInput
  ): Promise<CriarEscritorioResult> {
    return prisma.$transaction(async (tx) => {
      const escritorio = await escritorioRepository.create(
        {
          nome: dados.nome,
          oabResponsavel: dados.oabResponsavel,
          telefoneWhatsapp: dados.telefoneWhatsapp,
        },
        tx
      );

      const membro = await membroRepository.create(
        {
          usuario: { connect: { id: usuarioId } },
          escritorio: { connect: { id: escritorio.id } },
          role: "owner",
        },
        tx
      );

      return { escritorio, membro };
    });
  },

  async obterEscritorioAtivo(ctx: TenantContext): Promise<Escritorio> {
    const escritorio = await escritorioRepository.findById(ctx.escritorioId);
    if (!escritorio) {
      throw new EscritorioNaoEncontradoError();
    }
    return escritorio;
  },

  // Somente owner/admin editam os dados do escritório (padrao só lê).
  async atualizarEscritorio(
    ctx: TenantContext,
    dados: AtualizarEscritorioInput
  ): Promise<Escritorio> {
    if (ctx.role === "padrao") {
      throw new PermissaoNegadaError();
    }
    return escritorioRepository.update(ctx.escritorioId, dados);
  },
};
