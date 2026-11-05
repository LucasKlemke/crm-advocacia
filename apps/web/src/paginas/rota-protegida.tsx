import { Navigate, Outlet, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { QueryProvider } from "@/components/providers/query-provider";
import { useSessao } from "@/lib/sessao";

export interface RotaProtegidaProps {
  /** false só no onboarding: basta estar logado, ainda sem escritório. */
  exigirEscritorio?: boolean;
}

// Substitui o proxy.ts do Next (RN01) e os redirects do (dashboard)/layout.tsx: sem sessão
// → /login com o destino guardado; sem escritório ativo → /onboarding. O cache de dados
// nasce aqui, preso ao escritório da sessão (QueryProvider troca o client inteiro quando
// o tenant muda — RN19 no front).
export function RotaProtegida({ exigirEscritorio = true }: RotaProtegidaProps) {
  const { data: sessao, isPending, isError, refetch } = useSessao();
  const { pathname, search } = useLocation();

  if (isPending) {
    return (
      <div
        role="status"
        className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground"
      >
        Carregando…
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center"
      >
        <p className="text-sm text-muted-foreground">Não foi possível verificar sua sessão.</p>
        <Button variant="outline" onClick={() => void refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!sessao) {
    return <Navigate replace to={`/login?callbackUrl=${encodeURIComponent(pathname + search)}`} />;
  }

  if (exigirEscritorio && !sessao.escritorioId) {
    return <Navigate replace to="/onboarding" />;
  }

  return (
    <QueryProvider escritorioId={sessao.escritorioId ?? undefined}>
      <Outlet />
    </QueryProvider>
  );
}
