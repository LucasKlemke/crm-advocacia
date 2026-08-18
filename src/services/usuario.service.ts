import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { usuarioRepository } from "@/repositories/usuario.repository";
import { conviteRepository } from "@/repositories/convite.repository";
import { membroRepository } from "@/repositories/membro.repository";
import type { Usuario } from "@prisma/client";

const SALT_ROUNDS = 10;

export class EmailJaCadastradoError extends Error {
  constructor() {
    super("Este e-mail já está cadastrado.");
    this.name = "EmailJaCadastradoError";
  }
}

export class SenhaAtualIncorretaError extends Error {
  constructor() {
    super("A senha atual informada está incorreta.");
    this.name = "SenhaAtualIncorretaError";
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export interface CadastrarUsuarioInput {
  nome: string;
  email: string;
  senha: string;
}

export interface CadastrarUsuarioResult {
  usuario: Usuario;
  temEscritorio: boolean;
}

export interface AtualizarPerfilInput {
  nome?: string;
  email?: string;
}

export const usuarioService = {
  // Cadastro coleta apenas nome/e-mail/senha (self-service). Se havia convite(s)
  // pendente(s) para o e-mail, o usuário já entra como membro dos respectivos
  // escritórios (temEscritorio: true) — senão segue para o onboarding.
  async cadastrarUsuario(input: CadastrarUsuarioInput): Promise<CadastrarUsuarioResult> {
    const existente = await usuarioRepository.findByEmail(input.email);
    if (existente) {
      throw new EmailJaCadastradoError();
    }

    const senhaHash = await bcrypt.hash(input.senha, SALT_ROUNDS);

    try {
      return await prisma.$transaction(async (tx) => {
        const usuario = await usuarioRepository.create(
          { nome: input.nome, email: input.email, senhaHash },
          tx
        );

        const convitesPendentes = await conviteRepository.listarPorEmail(input.email, tx);

        for (const convite of convitesPendentes) {
          await membroRepository.create(
            {
              usuario: { connect: { id: usuario.id } },
              escritorio: { connect: { id: convite.escritorioId } },
              role: convite.role,
            },
            tx
          );
        }

        if (convitesPendentes.length > 0) {
          await conviteRepository.removerTodosPorEmail(input.email, tx);
        }

        return { usuario, temEscritorio: convitesPendentes.length > 0 };
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new EmailJaCadastradoError();
      }
      throw error;
    }
  },

  async atualizarPerfil(usuarioId: string, dados: AtualizarPerfilInput): Promise<Usuario> {
    if (dados.email) {
      const existente = await usuarioRepository.findByEmail(dados.email);
      if (existente && existente.id !== usuarioId) {
        throw new EmailJaCadastradoError();
      }
    }

    return usuarioRepository.update(usuarioId, {
      ...(dados.nome ? { nome: dados.nome } : {}),
      ...(dados.email ? { email: dados.email } : {}),
    });
  },

  async alterarSenha(usuarioId: string, senhaAtual: string, novaSenha: string): Promise<void> {
    const usuario = await usuarioRepository.findById(usuarioId);
    if (!usuario) {
      throw new SenhaAtualIncorretaError();
    }

    const senhaValida = await bcrypt.compare(senhaAtual, usuario.senhaHash);
    if (!senhaValida) {
      throw new SenhaAtualIncorretaError();
    }

    const novaSenhaHash = await bcrypt.hash(novaSenha, SALT_ROUNDS);
    await usuarioRepository.updateSenhaHash(usuarioId, novaSenhaHash);
  },
};
