import { lerSessaoDoServidor } from "@/lib/auth/sessao-servidor";
import { resolverTenantContext, type TenantContext } from "@/lib/auth/resolver-tenant";

export {
  NaoAutenticadoError,
  SemEscritorioAtivoError,
  AcessoNegadoError,
  type TenantContext,
} from "@/lib/auth/resolver-tenant";

// Server Components do Next que acessam dados de tenant passam por aqui (RN19). A regra
// mora em resolver-tenant.ts, compartilhada com o TenantGuard da API Nest; a sessão é o
// cookie crm_sessao (src/lib/auth/sessao-jwt.ts).
export async function getTenantContext(): Promise<TenantContext> {
  const sessao = await lerSessaoDoServidor();
  return resolverTenantContext(sessao ? { usuarioId: sessao.sub, escritorioId: sessao.escritorioId } : null);
}
