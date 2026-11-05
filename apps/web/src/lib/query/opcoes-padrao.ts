import { ehSessaoExpirada } from "@/lib/api-client";

// Defaults do React Query do app.
export const opcoesPadraoQuery = {
  staleTime: 30_000,
  refetchOnWindowFocus: false,
  // Sessão expirada não se resolve tentando de novo (o apiFetch já leva o
  // usuário ao login): repetir só atrasaria o erro aparecer na tela.
  retry: (falhas: number, erro: unknown) => !ehSessaoExpirada(erro) && falhas < 1,
} as const;
