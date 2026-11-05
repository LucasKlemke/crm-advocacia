import { auth } from "@/lib/auth/config";
import { resolverTenantContext, type TenantContext } from "@/lib/auth/resolver-tenant";

export {
  NaoAutenticadoError,
  SemEscritorioAtivoError,
  AcessoNegadoError,
  type TenantContext,
} from "@/lib/auth/resolver-tenant";

// Toda rota/Service do Next que acessa dados de tenant passa por aqui (RN19). A regra
// em si mora em resolver-tenant.ts, compartilhada com o TenantGuard da API Nest.
export async function getTenantContext(): Promise<TenantContext> {
  const session = await auth();
  return resolverTenantContext(
    session?.user
      ? { usuarioId: session.user.id, escritorioId: session.user.escritorioId }
      : null
  );
}
