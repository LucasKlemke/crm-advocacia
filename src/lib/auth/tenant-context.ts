import { auth } from "@/lib/auth/config";
import { membroRepository } from "@/repositories/membro.repository";
import type { RoleMembro } from "@prisma/client";

export interface TenantContext {
  usuarioId: string;
  escritorioId: string;
  role: RoleMembro;
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

// Toda rota/Service que acessa dados de tenant deve passar por aqui primeiro (RN19):
// nenhum Repository é chamado sem um escritorioId vindo da sessão autenticada.
//
// Crítico: o `role` sai sempre do banco (membership atual), nunca do JWT — o JWT pode
// estar com um valor stale entre atualizações de papel, e /api/auth/session é uma rota
// pública que não pode ser a fonte de verdade de autorização.
export async function getTenantContext(): Promise<TenantContext> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new NaoAutenticadoError();
  }

  if (!session.user.escritorioId) {
    throw new SemEscritorioAtivoError();
  }

  const membro = await membroRepository.findByUsuarioEEscritorio(
    session.user.id,
    session.user.escritorioId
  );
  if (!membro) {
    throw new AcessoNegadoError();
  }

  return {
    usuarioId: session.user.id,
    escritorioId: session.user.escritorioId,
    role: membro.role,
  };
}
