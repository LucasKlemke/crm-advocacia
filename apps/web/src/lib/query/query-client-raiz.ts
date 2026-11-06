import { QueryClient } from "@tanstack/react-query";
import { opcoesPadraoQuery } from "@/lib/query/opcoes-padrao";

// Client de fora do tenant: guarda a sessão (GET /api/auth/sessao) e serve as telas
// públicas (login, cadastro). Os dados do escritório vivem no client do QueryProvider,
// recriado a cada troca de tenant — a sessão não pode morar lá, porque é ela que diz
// qual é o tenant.
export const queryClientRaiz = new QueryClient({
  defaultOptions: { queries: opcoesPadraoQuery },
});
