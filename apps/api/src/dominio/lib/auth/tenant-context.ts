// Reexporta os erros e o tipo do contexto de tenant (RN19). A regra mora em
// resolver-tenant.ts, usada pelo TenantGuard da API Nest; a sessão é o cookie crm_sessao
// (dominio/lib/auth/sessao-jwt.ts).
export {
  NaoAutenticadoError,
  SemEscritorioAtivoError,
  AcessoNegadoError,
  type TenantContext,
} from "@dominio/lib/auth/resolver-tenant";
