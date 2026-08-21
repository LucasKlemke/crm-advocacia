"use client";

import { useState } from "react";
import { Plus, User, Users } from "lucide-react";
import { useDashboardResumo } from "@/hooks/use-dashboard";
import { useCasoFiltroOpcoes } from "@/hooks/use-casos";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardSaudacaoCard } from "@/components/dashboard/dashboard-saudacao-card";
import { StatusStatCards } from "@/components/dashboard/status-stat-cards";
import { CasosTabelaSimplificada } from "@/components/dashboard/casos-tabela-simplificada";
import { CasosStatusDonutChart } from "@/components/dashboard/casos-status-donut-chart";
import { CasoSheet } from "@/components/casos/caso-sheet";
import { FiltroMultiSelect } from "@/components/casos/filtro-multi-select";
import { FiltroPeriodo, type PeriodoFiltro } from "@/components/casos/filtro-periodo";
import { formatarCpf } from "@/lib/utils/cpf";
import { filtrosCasosPadrao, SEM_RESPONSAVEL } from "@/types/caso";
import { filtrosDashboardPadrao } from "@/types/dashboard";
import type { FiltrosCasos } from "@/types/caso";
import type { ContagemPorTipoStatusDTO, FiltrosDashboard } from "@/types/dashboard";
import type { RoleMembro } from "@prisma/client";

export interface DashboardViewProps {
  atorUsuarioId: string;
  atorNome: string;
  atorRole: RoleMembro;
}

// Boundary cliente da tela /: o filtro de responsável/cliente/período no topo se
// aplica a tudo (cards, gráficos e tabela de preview) — vale dizer, ao próprio
// useDashboardResumo, não só à tabela.
export function DashboardView({ atorUsuarioId, atorNome, atorRole }: DashboardViewProps) {
  const [filtrosDashboard, setFiltrosDashboard] = useState<FiltrosDashboard>(filtrosDashboardPadrao);
  const { data, isLoading, isError } = useDashboardResumo(filtrosDashboard);
  const { data: opcoes } = useCasoFiltroOpcoes();
  const [selecionadosIds, setSelecionadosIds] = useState<string[]>([]);
  const [criandoCaso, setCriandoCaso] = useState(false);

  // Clicar alterna o TipoStatus dentro/fora da seleção — múltiplos cards podem ficar
  // ativos ao mesmo tempo, e a tabela filtra por todos eles juntos (OR).
  function selecionarTipoStatus(contagem: ContagemPorTipoStatusDTO) {
    setSelecionadosIds((atual) =>
      atual.includes(contagem.tipoStatus.id)
        ? atual.filter((id) => id !== contagem.tipoStatus.id)
        : [...atual, contagem.tipoStatus.id]
    );
  }

  const opcoesResponsavel = [{ id: SEM_RESPONSAVEL, nome: "Sem responsável" }, ...(opcoes?.membros ?? [])];

  function periodo(): PeriodoFiltro {
    return { dataInicio: filtrosDashboard.dataInicio, dataFim: filtrosDashboard.dataFim };
  }

  const filtrosTabela: FiltrosCasos = {
    ...filtrosCasosPadrao,
    tipoStatusIds: selecionadosIds,
    clienteIds: filtrosDashboard.clienteIds,
    responsavelIds: filtrosDashboard.responsavelIds,
    dataInicio: filtrosDashboard.dataInicio,
    dataFim: filtrosDashboard.dataFim,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {!isLoading && !isError && data ? <DashboardSaudacaoCard nome={atorNome} /> : <div />}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setCriandoCaso(true)}>
            <Plus />
            Novo processo
          </Button>

          <FiltroMultiSelect
            label="Responsável"
            icone={Users}
            opcoes={opcoesResponsavel}
            selecionados={filtrosDashboard.responsavelIds}
            onChange={(responsavelIds) =>
              setFiltrosDashboard({ ...filtrosDashboard, responsavelIds })
            }
            buscaPlaceholder="Buscar responsável..."
            avatares
          />

          <FiltroMultiSelect
            label="Cliente"
            icone={User}
            opcoes={(opcoes?.clientes ?? []).map((c) => ({
              id: c.id,
              nome: c.nome,
              subtitulo: formatarCpf(c.cpf),
            }))}
            selecionados={filtrosDashboard.clienteIds}
            onChange={(clienteIds) => setFiltrosDashboard({ ...filtrosDashboard, clienteIds })}
            buscaPlaceholder="Buscar cliente..."
          />

          <FiltroPeriodo
            valor={periodo()}
            onChange={(novoPeriodo) => setFiltrosDashboard({ ...filtrosDashboard, ...novoPeriodo })}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, indice) => (
              <Skeleton key={indice} className="h-24 w-full" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        </div>
      ) : isError || !data ? (
        <p className="p-4 text-sm text-destructive">Não foi possível carregar o painel.</p>
      ) : (
        <>
          <StatusStatCards
            porTipoStatus={data.porTipoStatus}
            selecionadosIds={selecionadosIds}
            onSelect={selecionarTipoStatus}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <CasosTabelaSimplificada
              filtros={filtrosTabela}
              atorUsuarioId={atorUsuarioId}
              atorNome={atorNome}
              atorRole={atorRole}
            />
            <CasosStatusDonutChart porTipoStatus={data.porTipoStatus} />
          </div>
        </>
      )}

      <CasoSheet
        modo="criar"
        caso={null}
        aberto={criandoCaso}
        onOpenChange={setCriandoCaso}
        atorUsuarioId={atorUsuarioId}
        atorNome={atorNome}
        atorRole={atorRole}
      />
    </div>
  );
}
