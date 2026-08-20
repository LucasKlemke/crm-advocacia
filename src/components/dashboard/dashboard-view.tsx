"use client";

import { useState } from "react";
import Link from "next/link";
import { User, Users } from "lucide-react";
import { useDashboardResumo } from "@/hooks/use-dashboard";
import { useCasoFiltroOpcoes } from "@/hooks/use-casos";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusStatCards } from "@/components/dashboard/status-stat-cards";
import { CasosPorTipoStatusChart } from "@/components/dashboard/casos-por-tipo-status-chart";
import { CasosPorMesChart } from "@/components/dashboard/casos-por-mes-chart";
import { CasosTable } from "@/components/casos/casos-table";
import { CasoSheet, type ModoSheet } from "@/components/casos/caso-sheet";
import { FiltroMultiSelect } from "@/components/casos/filtro-multi-select";
import { FiltroPeriodo, type PeriodoFiltro } from "@/components/casos/filtro-periodo";
import { formatarCpf } from "@/lib/utils/cpf";
import { filtrosCasosPadrao, SEM_RESPONSAVEL } from "@/types/caso";
import { filtrosDashboardPadrao } from "@/types/dashboard";
import type { CasoDTO, FiltrosCasos } from "@/types/caso";
import type { ContagemPorTipoStatusDTO, FiltrosDashboard } from "@/types/dashboard";
import type { RoleMembro } from "@prisma/client";

export interface DashboardViewProps {
  atorUsuarioId: string;
  atorNome: string;
  atorRole: RoleMembro;
}

// Boundary cliente da tela /: o filtro de responsável/cliente/período no topo se
// aplica a tudo (cards, gráficos e tabela) — vale dizer, ao próprio useDashboardResumo,
// não só à tabela. A tabela de processos abre o CasoSheet ao clicar num caso, por isso
// precisa do ator, como CasosView.
export function DashboardView({ atorUsuarioId, atorNome, atorRole }: DashboardViewProps) {
  const [filtrosDashboard, setFiltrosDashboard] = useState<FiltrosDashboard>(filtrosDashboardPadrao);
  const { data, isLoading, isError } = useDashboardResumo(filtrosDashboard);
  const { data: opcoes } = useCasoFiltroOpcoes();
  const [selecionado, setSelecionado] = useState<ContagemPorTipoStatusDTO | null>(null);
  const [sheet, setSheet] = useState<{ modo: ModoSheet; caso: CasoDTO | null } | null>(null);

  function selecionarTipoStatus(contagem: ContagemPorTipoStatusDTO) {
    const jaSelecionado = selecionado?.tipoStatus.id === contagem.tipoStatus.id;
    setSelecionado(jaSelecionado ? null : contagem);
  }

  const opcoesResponsavel = [{ id: SEM_RESPONSAVEL, nome: "Sem responsável" }, ...(opcoes?.membros ?? [])];

  function periodo(): PeriodoFiltro {
    return { dataInicio: filtrosDashboard.dataInicio, dataFim: filtrosDashboard.dataFim };
  }

  const filtrosTabela: FiltrosCasos = {
    ...filtrosCasosPadrao,
    tipoStatusIds: selecionado ? [selecionado.tipoStatus.id] : [],
    clienteIds: filtrosDashboard.clienteIds,
    responsavelIds: filtrosDashboard.responsavelIds,
    dataInicio: filtrosDashboard.dataInicio,
    dataFim: filtrosDashboard.dataFim,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
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

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {Array.from({ length: 7 }).map((_, indice) => (
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
            valorTotalAberto={data.valorTotalAberto}
            onSelect={selecionarTipoStatus}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <CasosPorTipoStatusChart porTipoStatus={data.porTipoStatus} />
            <CasosPorMesChart porMes={data.porMes} />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">
                Processos{selecionado ? ` — ${selecionado.tipoStatus.nome}` : ""}
              </h2>
              <div className="flex items-center gap-2">
                {selecionado && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => selecionarTipoStatus(selecionado)}
                  >
                    Limpar filtro
                  </Button>
                )}
                <Link href="/casos" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Ver todos
                </Link>
              </div>
            </div>

            <CasosTable
              filtros={filtrosTabela}
              onFiltrosChange={() => {}}
              onAbrirCaso={(caso) => setSheet({ modo: "ver", caso })}
              limite={10}
            />
          </div>
        </>
      )}

      <CasoSheet
        modo={sheet?.modo ?? "ver"}
        caso={sheet?.caso ?? null}
        aberto={sheet !== null}
        onOpenChange={(aberto) => setSheet(aberto ? sheet : null)}
        atorUsuarioId={atorUsuarioId}
        atorNome={atorNome}
        atorRole={atorRole}
      />
    </div>
  );
}
