import { Suspense } from "react";
import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { auth } from "@/lib/auth/config";
import { getTenantContextOuRedirect } from "./_lib/tenant-context-pagina";
import { getQueryClientServidor } from "@/lib/query/query-client-servidor";
import { paraJson } from "@/lib/api/json";
import { montarListaCasos } from "@/lib/api/payloads/casos-lista";
import { montarOpcoesFiltroCaso } from "@/lib/api/payloads/casos-filtros";
import { dashboardService } from "@/services/dashboard.service";
import {
  chaveCasos,
  chaveCasosFiltroOpcoes,
  chaveDashboardResumo,
} from "@/lib/query/chaves";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { filtrosTabelaDashboard } from "@/components/dashboard/filtros-tabela";
import { formatarDataExtensa } from "@/lib/utils/data";
import { filtrosDashboardPadrao } from "@/types/dashboard";
import type { TenantContext } from "@/lib/auth/tenant-context";
import type { FiltrosCasoOpcoes, ListaCasos } from "@/types/caso";
import type { ResumoDashboardDTO } from "@/types/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

// As três consultas que a tela faria depois de hidratar, resolvidas em paralelo aqui no
// servidor e entregues prontas ao React Query. As keys são as mesmas dos hooks
// (useDashboardResumo/useCasos/useCasoFiltroOpcoes) no estado inicial dos filtros — trocar
// um filtro volta ao caminho HTTP normal, como antes.
//
// `paraJson` reproduz a serialização que a rota faria: sem isso o cliente receberia Date e
// Decimal onde os DTOs prometem string e número.
async function DashboardComDados({
  ctx,
  atorNome,
  dataHoje,
}: {
  ctx: TenantContext;
  atorNome: string;
  dataHoje: string;
}) {
  const queryClient = getQueryClientServidor();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: chaveDashboardResumo(),
      queryFn: async () => paraJson<ResumoDashboardDTO>(await dashboardService.resumo(ctx)),
    }),
    queryClient.prefetchQuery({
      queryKey: chaveCasos(filtrosTabelaDashboard(filtrosDashboardPadrao, [])),
      queryFn: async () => paraJson<ListaCasos>(await montarListaCasos(ctx, {}, 1)),
    }),
    queryClient.prefetchQuery({
      queryKey: chaveCasosFiltroOpcoes(),
      queryFn: async () => paraJson<FiltrosCasoOpcoes>(await montarOpcoesFiltroCaso(ctx)),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardView
        atorUsuarioId={ctx.usuarioId}
        atorNome={atorNome}
        atorRole={ctx.role}
        dataHoje={dataHoje}
      />
    </HydrationBoundary>
  );
}

// O <Suspense> deixa o shell (header, sidebar, saudação e esqueletos) ser enviado
// imediatamente, enquanto as consultas ao banco ainda rodam: o usuário vê a página
// montada antes de os dados existirem, e eles streamam por cima.
//
// Se um prefetch falhar, `prefetchQuery` engole o erro e o cache fica vazio — o cliente
// refaz a busca pelo caminho HTTP normal e cai no tratamento de erro que a view já tem.
export default async function DashboardPage() {
  const [ctx, session] = await Promise.all([getTenantContextOuRedirect(), auth()]);
  const atorNome = session?.user?.name ?? "";
  // Mesma data formatada no servidor que o header do shell já usa (layout.tsx).
  const dataHoje = formatarDataExtensa(new Date());

  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<DashboardSkeleton nome={atorNome} dataHoje={dataHoje} />}>
        <DashboardComDados ctx={ctx} atorNome={atorNome} dataHoje={dataHoje} />
      </Suspense>
    </div>
  );
}
