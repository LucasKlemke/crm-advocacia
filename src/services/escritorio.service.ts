import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { escritorioRepository } from "@/repositories/escritorio.repository";
import { usuarioRepository } from "@/repositories/usuario.repository";
import type { Escritorio, Usuario } from "@prisma/client";

const SALT_ROUNDS = 10;

export class EmailJaCadastradoError extends Error {
  constructor() {
    super("Este e-mail já está cadastrado em outro escritório.");
    this.name = "EmailJaCadastradoError";
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export interface CadastrarEscritorioInput {
  nomeEscritorio: string;
  oabResponsavel?: string;
  telefoneWhatsapp?: string;
  nomeTitular: string;
  email: string;
  senha: string;
  oabTitular?: string;
  telefoneTitular?: string;
}

export interface CadastrarEscritorioResult {
  escritorio: Escritorio;
  titular: Usuario;
}

export const escritorioService = {
  // Cria escritório + usuário titular numa única operação (RN02); todo usuário
  // criado por este fluxo é sempre titular.
  async cadastrarEscritorio(
    input: CadastrarEscritorioInput
  ): Promise<CadastrarEscritorioResult> {
    const emailExistente = await usuarioRepository.findByEmail(input.email);
    if (emailExistente) {
      throw new EmailJaCadastradoError();
    }

    const senhaHash = await bcrypt.hash(input.senha, SALT_ROUNDS);

    try {
      return await prisma.$transaction(async (tx) => {
        const escritorio = await escritorioRepository.create(
          {
            nome: input.nomeEscritorio,
            oabResponsavel: input.oabResponsavel,
            telefoneWhatsapp: input.telefoneWhatsapp,
          },
          tx
        );

        const titular = await usuarioRepository.create(
          {
            nome: input.nomeTitular,
            email: input.email,
            senhaHash,
            oab: input.oabTitular,
            telefone: input.telefoneTitular,
            role: "titular",
            escritorio: { connect: { id: escritorio.id } },
          },
          tx
        );

        return { escritorio, titular };
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new EmailJaCadastradoError();
      }
      throw error;
    }
  },
};
