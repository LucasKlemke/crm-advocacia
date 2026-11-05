export interface PaginaEmMigracaoProps {
  /** Página do Next que esta rota ainda espera, ex.: "src/app/(dashboard)/clientes/page.tsx". */
  caminhoNext: string;
}

// Marcador provisório da Fase 4: a árvore de rotas do React nasce completa (parte A) e
// cada rota aponta para cá até a parte B portar a página do Next correspondente.
export function PaginaEmMigracao({ caminhoNext }: PaginaEmMigracaoProps) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-xl font-semibold text-foreground">Página em migração</h1>
      <p className="text-sm text-muted-foreground">
        Origem no Next: <code className="font-mono">{caminhoNext}</code>
      </p>
    </section>
  );
}
