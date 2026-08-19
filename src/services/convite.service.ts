import { conviteRepository } from "@/repositories/convite.repository";
import { membroRepository } from "@/repositories/membro.repository";
import { usuarioRepository } from "@/repositories/usuario.repository";
import { podeAtribuirRole } from "@/lib/auth/permissoes";
import { PermissaoNegadaError } from "@/services/membro.service";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { Convite, Membro, RoleMembro } from "@prisma/client";

export { PermissaoNegadaError };

export class ConviteJaExisteError extends Error {
  constructor() {
    super("Já existe um convite pendente para este e-mail.");
    this.name = "ConviteJaExisteError";
  }
}

export class JaEhMembroError extends Error {
  constructor() {
    super("Este usuário já é membro do escritório.");
    this.name = "JaEhMembroError";
  }
}

export class ConviteNaoEncontradoError extends Error {
  constructor() {
    super("Convite não encontrado.");
    this.name = "ConviteNaoEncontradoError";
  }
}

export interface ConvidarInput {
  email: string;
  role: RoleMembro;
}

export type ConvidarResult =
  | { tipo: "membro"; membro: Membro }
  | { tipo: "convite"; convite: Convite };

export const conviteService = {
  // Se o e-mail já é um usuário cadastrado, vira membro direto; senão grava o convite
  // pendente que é consumido no cadastro (usuarioService.cadastrarUsuario).
  async convidar(ctx: TenantContext, dados: ConvidarInput): Promise<ConvidarResult> {
    if (ctx.role === "padrao" || !podeAtribuirRole(ctx.role, dados.role)) {
      throw new PermissaoNegadaError();
    }

    const usuarioExistente = await usuarioRepository.findByEmail(dados.email);

    if (usuarioExistente) {
      const jaEhMembro = await membroRepository.findByUsuarioEEscritorio(
        usuarioExistente.id,
        ctx.escritorioId
      );
      if (jaEhMembro) {
        throw new JaEhMembroError();
      }

      const membro = await membroRepository.create({
        usuario: { connect: { id: usuarioExistente.id } },
        escritorio: { connect: { id: ctx.escritorioId } },
        role: dados.role,
      });
      return { tipo: "membro", membro };
    }

    const conviteExistente = await conviteRepository.findByEscritorioEEmail(
      ctx.escritorioId,
      dados.email
    );
    if (conviteExistente) {
      if (conviteExistente.expiraEm > new Date()) {
        throw new ConviteJaExisteError();
      }
      // Convite anterior expirado: descarta e deixa criar um novo abaixo.
      await conviteRepository.remover(conviteExistente.id);
    }

    const convite = await conviteRepository.create({
      email: dados.email,
      role: dados.role,
      escritorio: { connect: { id: ctx.escritorioId } },
      criadoPor: { connect: { id: ctx.usuarioId } },
    });
    return { tipo: "convite", convite };
  },

  async listarPendentes(ctx: TenantContext): Promise<Convite[]> {
    if (ctx.role === "padrao") {
      throw new PermissaoNegadaError();
    }
    return conviteRepository.listarPorEscritorio(ctx.escritorioId);
  },

  async cancelar(ctx: TenantContext, conviteId: string): Promise<void> {
    const convite = await conviteRepository.findById(conviteId);
    if (!convite || convite.escritorioId !== ctx.escritorioId) {
      throw new ConviteNaoEncontradoError();
    }
    if (ctx.role === "padrao") {
      throw new PermissaoNegadaError();
    }
    await conviteRepository.remover(conviteId);
  },
};
