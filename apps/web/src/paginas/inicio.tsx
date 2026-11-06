import { useMemo } from "react";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { useSessaoDoEscritorio } from "@/hooks/use-sessao-do-escritorio";
import { useTituloPagina } from "@/hooks/use-titulo-pagina";
import { formatarDataExtensa } from "@/lib/utils/data";

// Sem prefetch: o DashboardView busca resumo, tabela e opções de filtro pelos próprios
// hooks e mostra o próprio esqueleto enquanto carrega.
export function PaginaInicio() {
  useTituloPagina("Dashboard");
  const sessao = useSessaoDoEscritorio();
  const dataHoje = useMemo(() => formatarDataExtensa(new Date()), []);

  return (
    <div className="flex flex-col gap-6">
      <DashboardView
        atorUsuarioId={sessao.usuario.id}
        atorNome={sessao.usuario.nome}
        atorRole={sessao.role}
        dataHoje={dataHoje}
      />
    </div>
  );
}
