import { ehSessaoExpirada } from "@/lib/api-client";

// Defaults do React Query compartilhados pelo client do navegador (QueryProvider) e pelo
// client efêmero usado no prefetch do servidor. Se os dois divergissem, um dado
// prefetchado no servidor poderia nascer "stale" no cliente e ser refeito na hidratação —
// exatamente o round-trip que o prefetch existe para evitar.
export const opcoesPadraoQuery = {
  staleTime: 30_000,
  refetchOnWindowFocus: false,
  // Sessão expirada não se resolve tentando de novo (o apiFetch já leva o
  // usuário ao login): repetir só atrasaria o erro aparecer na tela.
  retry: (falhas: number, erro: unknown) => !ehSessaoExpirada(erro) && falhas < 1,
} as const;
