import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardSaudacaoCard } from "@/components/dashboard/dashboard-saudacao-card";
import { CasosTabelaSimplificadaSkeleton } from "@/components/dashboard/casos-tabela-simplificada";

// Nº de TipoStatus do seed (referência global, fixa em 6 — docs/database/schema.md).
// O esqueleto reserva o mesmo espaço que os cards reais vão ocupar, então a grade não
// muda de altura quando o resumo chega.
const TIPOS_STATUS_SEED = 6;

// Mesma grade de status-stat-cards.tsx, com o miolo de cada Card trocado por
// placeholders — ícone, nome, valor em destaque e percentual.
export function StatusStatCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: TIPOS_STATUS_SEED }).map((_, indice) => (
        <Card key={indice} size="sm" className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center gap-1.5">
              <Skeleton className="size-4 shrink-0 rounded" />
              <Skeleton className="h-4 w-20" />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-10" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Mesmo Card e mesma disposição de casos-status-donut-chart.tsx: o anel no lugar da
// rosca (as fatias) e uma linha de legenda por tipo de status.
export function CasosStatusDonutChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-44" />
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <div className="mx-auto flex h-64 w-full max-w-64 items-center justify-center">
          <Skeleton className="size-44 rounded-full" />
        </div>
        <ul className="flex flex-col gap-1.5">
          {Array.from({ length: TIPOS_STATUS_SEED }).map((_, indice) => (
            <li key={indice} className="flex items-center gap-1.5">
              <Skeleton className="size-2 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export interface DashboardSkeletonProps {
  nome: string;
  dataHoje: string;
}

// Fallback do <Suspense> de (dashboard)/page.tsx enquanto os dados streamam do servidor.
// Espelha a estrutura de dashboard-view.tsx peça por peça, e a saudação já é a real: ela
// depende só do nome, que veio junto da sessão e não precisa esperar consulta nenhuma.
export function DashboardSkeleton({ nome, dataHoje }: DashboardSkeletonProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <DashboardSaudacaoCard nome={nome} data={dataHoje} />

        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-38 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-26 rounded-md" />
          <Skeleton className="h-9 w-30 rounded-md" />
        </div>
      </div>

      <StatusStatCardsSkeleton />

      <div className="grid gap-4 lg:grid-cols-2">
        <CasosTabelaSimplificadaSkeleton />
        <CasosStatusDonutChartSkeleton />
      </div>
    </div>
  );
}
