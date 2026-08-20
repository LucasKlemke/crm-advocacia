import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { usuarioRepository } from "@/repositories/usuario.repository";
import { conviteRepository } from "@/repositories/convite.repository";
import { membroRepository } from "@/repositories/membro.repository";
import { s3Client } from "@/lib/external/s3-client";
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

export class TamanhoAvatarInvalidoError extends Error {
  constructor() {
    super("A imagem excede o tamanho máximo permitido (5MB).");
    this.name = "TamanhoAvatarInvalidoError";
  }
}

const TAMANHO_MAXIMO_AVATAR_KB = 5 * 1024;

const MIME_POR_TIPO_AVATAR: Record<"jpeg" | "png" | "webp", string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

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

export interface UploadUrlAvatarInput {
  nomeArquivo: string;
  tipoArquivo: "jpeg" | "png" | "webp";
  tamanhoKb: number;
}

export interface UploadUrlAvatarResult {
  uploadUrl: string;
  storageKey: string;
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
        const agora = new Date();
        const convitesValidos = convitesPendentes.filter((convite) => convite.expiraEm > agora);

        for (const convite of convitesValidos) {
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

        return { usuario, temEscritorio: convitesValidos.length > 0 };
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new EmailJaCadastradoError();
      }
      throw error;
    }
  },

  // Fonte de verdade do perfil exibido na UI: o JWT carrega nome/e-mail do momento do
  // login e não é renovado pelo PATCH /api/perfil, então a página lê o usuário do banco.
  async obterPerfil(usuarioId: string): Promise<Usuario | null> {
    return usuarioRepository.findById(usuarioId);
  },

  async atualizarPerfil(usuarioId: string, dados: AtualizarPerfilInput): Promise<Usuario> {
    if (dados.email) {
      const existente = await usuarioRepository.findByEmail(dados.email);
      if (existente && existente.id !== usuarioId) {
        throw new EmailJaCadastradoError();
      }
    }

    try {
      return await usuarioRepository.update(usuarioId, {
        ...(dados.nome ? { nome: dados.nome } : {}),
        ...(dados.email ? { email: dados.email } : {}),
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new EmailJaCadastradoError();
      }
      throw error;
    }
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

  async gerarUrlUploadAvatar(
    usuarioId: string,
    input: UploadUrlAvatarInput
  ): Promise<UploadUrlAvatarResult> {
    if (input.tamanhoKb > TAMANHO_MAXIMO_AVATAR_KB) {
      throw new TamanhoAvatarInvalidoError();
    }

    const storageKey = `${process.env.AWS_S3_PREFIX}/avatares/${usuarioId}/${Date.now()}-${input.nomeArquivo}`;
    const uploadUrl = await s3Client.gerarUrlUpload(
      storageKey,
      MIME_POR_TIPO_AVATAR[input.tipoArquivo],
      input.tamanhoKb * 1024
    );

    return { uploadUrl, storageKey };
  },

  // Avatar não gera log de auditoria (é dado de perfil, não de domínio jurídico) nem
  // tabela própria — só sobrescreve usuario.avatar_url e libera a key antiga no S3.
  async confirmarUploadAvatar(usuarioId: string, storageKey: string): Promise<Usuario> {
    const atual = await usuarioRepository.findById(usuarioId);

    if (atual?.avatarUrl) {
      await s3Client.excluirArquivo(atual.avatarUrl);
    }

    return usuarioRepository.update(usuarioId, { avatarUrl: storageKey });
  },
};
