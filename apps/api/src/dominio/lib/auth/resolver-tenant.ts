import { membroRepository } from "@dominio/repositories/membro.repository";
import type { RoleMembro } from "@prisma/client";

// Regra de resolução do tenant (RN19) usada pelo TenantGuard da API Nest. Recebe só o que veio da
// sessão (id do usuário e escritório ativo) e consulta a membership no banco.
//
// Crítico: o `role` sai sempre do banco, nunca do JWT — o JWT pode estar com um valor
// stale entre atualizações de papel.

export interface TenantContext {
  usuarioId: string;
  escritorioId: string;
  role: RoleMembro;
}

export interface SessaoMinima {
  usuarioId?: string | null;
  escritorioId?: string | null;
}

export class NaoAutenticadoError extends Error {
  constructor() {
    super("Sessão inválida ou expirada.");
    this.name = "NaoAutenticadoError";
  }
}

export class SemEscritorioAtivoError extends Error {
  constructor() {
    super("Nenhum escritório ativo na sessão.");
    this.name = "SemEscritorioAtivoError";
  }
}

export class AcessoNegadoError extends Error {
  constructor() {
    super("Você não tem acesso a este escritório.");
    this.name = "AcessoNegadoError";
  }
}

export async function resolverTenantContext(sessao: SessaoMinima | null): Promise<TenantContext> {
  if (!sessao?.usuarioId) {
    throw new NaoAutenticadoError();
  }
  if (!sessao.escritorioId) {
    throw new SemEscritorioAtivoError();
  }

  const membro = await membroRepository.findByUsuarioEEscritorio(
    sessao.usuarioId,
    sessao.escritorioId
  );
  if (!membro) {
    throw new AcessoNegadoError();
  }

  return { usuarioId: sessao.usuarioId, escritorioId: sessao.escritorioId, role: membro.role };
}
