import { auth } from "@/lib/auth/config";

export interface TenantContext {
  usuarioId: string;
  escritorioId: string;
  role: string;
}

export class NaoAutenticadoError extends Error {
  constructor() {
    super("Sessão inválida ou expirada.");
    this.name = "NaoAutenticadoError";
  }
}

// Toda rota/Service que acessa dados de tenant deve passar por aqui primeiro (RN19):
// nenhum Repository é chamado sem um escritorioId vindo da sessão autenticada.
export async function getTenantContext(): Promise<TenantContext> {
  const session = await auth();
  if (!session?.user?.escritorioId) {
    throw new NaoAutenticadoError();
  }

  return {
    usuarioId: session.user.id,
    escritorioId: session.user.escritorioId,
    role: session.user.role,
  };
}
