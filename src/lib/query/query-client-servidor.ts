import { cache } from "react";
import { QueryClient } from "@tanstack/react-query";
import { opcoesPadraoQuery } from "@/lib/query/opcoes-padrao";

// Um QueryClient por requisição: `cache` do React memoiza dentro do request, então
// vários componentes de servidor da mesma página prefetcham no mesmo cache e um único
// `dehydrate` carrega tudo. Nunca é um singleton de módulo — isso vazaria dados de um
// escritório para a requisição de outro (RN19).
export const getQueryClientServidor = cache(
  () => new QueryClient({ defaultOptions: { queries: opcoesPadraoQuery } })
);
