import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useLocation,
  useNavigate,
  useParams as useParamsDoRouter,
  useSearchParams as useSearchParamsDoRouter,
} from "react-router";
import { chaveSessao } from "@/lib/query/chaves";
import { queryClientRaiz } from "@/lib/query/query-client-raiz";

// Mesma API de "next/navigation" que os componentes já usavam, implementada sobre o
// React Router — o código movido do Next roda sem reescrita (Fase 4 da migração).

export interface OpcoesNavegacao {
  /** `false` preserva a rolagem, como `{ scroll: false }` do App Router. */
  scroll?: boolean;
}

export interface RoteadorCompat {
  push(href: string, opcoes?: OpcoesNavegacao): void;
  replace(href: string, opcoes?: OpcoesNavegacao): void;
  back(): void;
  forward(): void;
  refresh(): void;
  prefetch(href: string): void;
}

export type ReadonlyURLSearchParams = Omit<URLSearchParams, "append" | "delete" | "set" | "sort">;

export function useRouter(): RoteadorCompat {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMemo<RoteadorCompat>(
    () => ({
      push: (href, opcoes) => {
        void navigate(href, { preventScrollReset: opcoes?.scroll === false });
      },
      replace: (href, opcoes) => {
        void navigate(href, { replace: true, preventScrollReset: opcoes?.scroll === false });
      },
      back: () => {
        void navigate(-1);
      },
      forward: () => {
        void navigate(1);
      },
      // No Next, refresh() relia os Server Components (dados + sessão). Aqui: invalida o
      // cache do tenant e a sessão — troca de escritório, papel alterado, perfil editado.
      refresh: () => {
        void queryClient.invalidateQueries();
        void queryClientRaiz.invalidateQueries({ queryKey: chaveSessao() });
      },
      // Sem prefetch de rota no SPA: o bundle das páginas já está carregado.
      prefetch: () => {},
    }),
    [navigate, queryClient]
  );
}

export function usePathname(): string {
  return useLocation().pathname;
}

export function useSearchParams(): ReadonlyURLSearchParams {
  const [params] = useSearchParamsDoRouter();
  return params;
}

export function useParams<
  T extends Record<string, string | undefined> = Record<string, string | undefined>,
>(): T {
  return useParamsDoRouter() as T;
}
