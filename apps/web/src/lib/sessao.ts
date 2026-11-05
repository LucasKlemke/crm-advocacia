import { useQuery } from "@tanstack/react-query";
import type { RoleMembro } from "@crm/compartilhado/enums";
import { ApiError, apiFetch } from "@/lib/api-client";
import { chaveSessao } from "@/lib/query/chaves";
import { queryClientRaiz } from "@/lib/query/query-client-raiz";

// Sessão no browser, falando com os endpoints de sessão da API Nest (Fase 3). O cookie
// crm_sessao é httpOnly: o browser só o recebe/limpa via Set-Cookie, nunca o lê — o que
// o front sabe da sessão vem sempre de GET /api/auth/sessao.

export interface UsuarioDaSessao {
  id: string;
  nome: string;
  email: string;
}

export interface Sessao {
  usuario: UsuarioDaSessao;
  /** null = logado sem escritório ativo (vai para /onboarding). */
  escritorioId: string | null;
  /** Sempre do banco (RN19); null quando não há escritório ativo. */
  role: RoleMembro | null;
}

// fetch cru, não apiFetch: aqui 401 é a resposta esperada para "ninguém logado" e vira
// null. O apiFetch trataria 401 como sessão expirada e faria um redirect duro para
// /login — inclusive a partir de /cadastro, onde por definição não há sessão.
export async function buscarSessao(): Promise<Sessao | null> {
  let resposta: Response;
  try {
    resposta = await fetch("/api/auth/sessao", { headers: { Accept: "application/json" } });
  } catch {
    throw new ApiError("Não foi possível conectar ao servidor.", 0);
  }

  if (resposta.status === 401) return null;
  if (!resposta.ok) {
    throw new ApiError("Não foi possível carregar a sessão.", resposta.status);
  }
  return (await resposta.json()) as Sessao;
}

// Sempre no queryClientRaiz (e não no client do contexto): a RotaProtegida lê a sessão
// para decidir qual client de tenant montar, então a sessão não pode morar dentro dele.
export function useSessao() {
  return useQuery(
    { queryKey: chaveSessao(), queryFn: buscarSessao, staleTime: Infinity, retry: false },
    queryClientRaiz
  );
}

export async function entrar(email: string, senha: string): Promise<boolean> {
  const resposta = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha }),
  });
  if (resposta.ok) return true;
  // 401 = credencial errada/usuário inativo; 400 = campo vazio. Para a tela, os dois são
  // "e-mail ou senha inválidos" — nunca revelar qual dos dois errou.
  if (resposta.status === 401 || resposta.status === 400) return false;
  throw new Error(`Falha ao entrar (HTTP ${resposta.status}).`);
}

export async function sair(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Sem rede o cookie continua no browser, mas a navegação para /login segue — o
    // usuário pode tentar de novo de lá.
  }
  // Nada do usuário que saiu sobrevive no cache. Quem chama faz a navegação dura.
  queryClientRaiz.clear();
}

// A API valida a membership e regrava o cookie; invalidar a sessão faz a RotaProtegida
// receber o novo escritorioId, e o QueryProvider troca o cache do tenant inteiro.
export async function trocarEscritorio(escritorioId: string): Promise<void> {
  await apiFetch<unknown>("/api/sessao/escritorio-ativo", {
    method: "POST",
    body: JSON.stringify({ escritorioId }),
  });
  await queryClientRaiz.invalidateQueries({ queryKey: chaveSessao() });
}
