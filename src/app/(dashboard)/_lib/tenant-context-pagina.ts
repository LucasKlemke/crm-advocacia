import { redirect } from "next/navigation";
import {
  getTenantContext,
  NaoAutenticadoError,
  SemEscritorioAtivoError,
  AcessoNegadoError,
  type TenantContext,
} from "@/lib/auth/tenant-context";

// Tradução dos erros do TenantContext (RN19) para navegação, compartilhada por todas as
// páginas do dashboard — sem isso cada página repetia o try/catch e esquecia algum caso.
//
// AcessoNegadoError acontece quando a sessão aponta para um escritório do qual o usuário
// não é mais membro (foi removido enquanto o JWT ainda estava válido): não é erro de
// servidor, é sessão apontando para um tenant inválido, então segue para /onboarding —
// mesmo destino de "sem escritório ativo", de onde o usuário cria/escolhe outro.
export async function getTenantContextOuRedirect(): Promise<TenantContext> {
  try {
    return await getTenantContext();
  } catch (error) {
    if (error instanceof NaoAutenticadoError) redirect("/login");
    if (error instanceof SemEscritorioAtivoError) redirect("/onboarding");
    if (error instanceof AcessoNegadoError) redirect("/onboarding");
    throw error;
  }
}
