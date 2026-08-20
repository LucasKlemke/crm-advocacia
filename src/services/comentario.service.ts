import { prisma } from "@/lib/prisma";
import { comentarioRepository } from "@/repositories/comentario.repository";
import { clienteService } from "@/services/cliente.service";
import { casoService } from "@/services/caso.service";
import { logService } from "@/services/log.service";
import { podeEditarComentario, podeModerarComentario } from "@/lib/auth/permissoes";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { Comentario, EscopoComentario } from "@prisma/client";

export class ComentarioNaoEncontradoError extends Error {
  constructor() {
    super("Comentário não encontrado.");
    this.name = "ComentarioNaoEncontradoError";
  }
}

export class PermissaoComentarioError extends Error {
  constructor() {
    super("Você não tem permissão para alterar este comentário.");
    this.name = "PermissaoComentarioError";
  }
}

export class ConteudoVazioError extends Error {
  constructor() {
    super("O comentário não pode ficar vazio.");
    this.name = "ConteudoVazioError";
  }
}

// Valida que o alvo do comentário existe e é do tenant, antes de ancorar qualquer coisa
// nele — como (escopo, escopo_id) não tem FK, essa checagem é a única garantia.
async function garantirEscopo(
  ctx: TenantContext,
  escopo: EscopoComentario,
  escopoId: string
): Promise<string> {
  switch (escopo) {
    case "cliente": {
      const cliente = await clienteService.obter(ctx, escopoId);
      return cliente.nome;
    }
    case "caso": {
      const caso = await casoService.obter(ctx, escopoId);
      return caso.titulo;
    }
  }
}

export const comentarioService = {
  async listar(ctx: TenantContext, escopo: EscopoComentario, escopoId: string) {
    await garantirEscopo(ctx, escopo, escopoId);
    return comentarioRepository.listarPorEscopo(ctx.escritorioId, escopo, escopoId);
  },

  async criar(
    ctx: TenantContext,
    escopo: EscopoComentario,
    escopoId: string,
    conteudo: string
  ): Promise<Comentario> {
    const texto = conteudo.trim();
    if (!texto) {
      throw new ConteudoVazioError();
    }
    const nomeAlvo = await garantirEscopo(ctx, escopo, escopoId);

    return prisma.$transaction(async (tx) => {
      const comentario = await comentarioRepository.create(
        {
          escopo,
          escopoId,
          conteudo: texto,
          escritorio: { connect: { id: ctx.escritorioId } },
          autor: { connect: { id: ctx.usuarioId } },
        },
        tx
      );

      await logService.registrar(
        ctx,
        {
          acao: "criar",
          entidade: "comentario",
          entidadeId: comentario.id,
          // "cliente"/"caso" já são a palavra certa em português para a frase.
          resumo: `Comentário adicionado ao ${escopo} ${nomeAlvo}`,
        },
        tx
      );

      return comentario;
    });
  },

  async atualizar(ctx: TenantContext, id: string, conteudo: string): Promise<Comentario> {
    const texto = conteudo.trim();
    if (!texto) {
      throw new ConteudoVazioError();
    }

    const atual = await this.obter(ctx, id);
    // Editar texto alheio é reescrever a fala de outra pessoa: nem owner pode.
    if (!podeEditarComentario(atual.autorUsuarioId === ctx.usuarioId)) {
      throw new PermissaoComentarioError();
    }
    if (atual.conteudo === texto) {
      return atual;
    }

    return prisma.$transaction(async (tx) => {
      const comentario = await comentarioRepository.update(
        id,
        { conteudo: texto, editadoEm: new Date() },
        tx
      );

      await logService.registrar(
        ctx,
        {
          acao: "atualizar",
          entidade: "comentario",
          entidadeId: id,
          resumo: "Comentário editado",
          dados: { conteudo: { antes: atual.conteudo, depois: texto } },
        },
        tx
      );

      return comentario;
    });
  },

  async excluir(ctx: TenantContext, id: string): Promise<void> {
    const atual = await this.obter(ctx, id);
    if (!podeModerarComentario(ctx.role, atual.autorUsuarioId === ctx.usuarioId)) {
      throw new PermissaoComentarioError();
    }

    await prisma.$transaction(async (tx) => {
      await comentarioRepository.marcarExcluido(id, new Date(), tx);
      await logService.registrar(
        ctx,
        {
          acao: "excluir",
          entidade: "comentario",
          entidadeId: id,
          resumo: "Comentário excluído",
        },
        tx
      );
    });
  },

  async obter(ctx: TenantContext, id: string): Promise<Comentario> {
    const comentario = await comentarioRepository.findById(id);
    if (
      !comentario ||
      comentario.escritorioId !== ctx.escritorioId ||
      comentario.softDeletedAt !== null
    ) {
      throw new ComentarioNaoEncontradoError();
    }
    return comentario;
  },
};
