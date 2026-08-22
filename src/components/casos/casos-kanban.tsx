"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Info } from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api-client";
import { useAtualizarCaso, useCasosKanban } from "@/hooks/use-casos";
import { CasoCard, CasoCardOverlay } from "@/components/casos/caso-card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MAPA_ICONES_STATUS } from "@/components/configuracoes/status-icone-picker";
import type { CasoDTO, ColunaKanban, FiltrosCasos, KanbanCasos, ListaCasos } from "@/types/caso";

export interface CasosKanbanProps {
  filtros: FiltrosCasos;
  onAbrirCaso: (caso: CasoDTO) => void;
}

interface EstadoColuna extends ColunaKanban {
  pagina: number;
  carregandoMais: boolean;
}

// `statusIds`/`tipoStatusIds` são repassados: colunas fora da seleção não aparecem
// no kanban (diferente de `paramsDeFiltros`, que só filtra o conteúdo de cada coluna).
function filtrosSemPagina(filtros: FiltrosCasos) {
  return {
    busca: filtros.busca,
    statusIds: filtros.statusIds,
    tipoStatusIds: filtros.tipoStatusIds,
    clienteIds: filtros.clienteIds,
    responsavelIds: filtros.responsavelIds,
    dataInicio: filtros.dataInicio,
    dataFim: filtros.dataFim,
    arquivado: filtros.arquivado,
  };
}

// Kanban com DndContext (dnd-kit): colunas = uma por Status do escritório, cartões
// arrastáveis para trocar de status. Estado local (não a cache do React Query) guarda
// as colunas — permite mover um card entre colunas otimisticamente e paginar cada
// coluna de forma independente, sem reconciliar isso com o cache de outra tela.
export function CasosKanban({ filtros, onAbrirCaso }: CasosKanbanProps) {
  const filtrosKanban = useMemo(() => filtrosSemPagina(filtros), [filtros]);
  const { data, isLoading, isError } = useCasosKanban(filtrosKanban);
  const atualizar = useAtualizarCaso();
  // Sem essa distância mínima, o próprio pointerdown do clique em um card já é lido
  // como início de arraste e o onClick do card nunca dispara — um clique real precisa
  // andar 8px antes de virar drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const [colunas, setColunas] = useState<EstadoColuna[]>([]);
  const [casoArrastado, setCasoArrastado] = useState<CasoDTO | null>(null);
  // Referência do último payload já espelhado em `colunas`, para recriar o estado
  // local durante a renderização (em vez de um useEffect) quando ele muda — padrão
  // "ajustar estado quando uma prop muda" documentado pelo React.
  const [dadosEspelhados, setDadosEspelhados] = useState<KanbanCasos | undefined>(undefined);

  // Filtro mudou (ou carregou pela primeira vez): as colunas nascem de novo a partir
  // do payload do kanban — qualquer paginação acumulada localmente é descartada, pois
  // o conjunto de casos visível mudou.
  if (data && data !== dadosEspelhados) {
    setDadosEspelhados(data);
    setColunas(data.colunas.map((coluna) => ({ ...coluna, pagina: 1, carregandoMais: false })));
  }

  async function carregarMais(statusId: string) {
    const coluna = colunas.find((c) => c.status.id === statusId);
    if (!coluna) return;

    const proximaPagina = coluna.pagina + 1;
    setColunas((atuais) =>
      atuais.map((c) => (c.status.id === statusId ? { ...c, carregandoMais: true } : c))
    );

    try {
      const params = new URLSearchParams();
      if (filtrosKanban.busca?.trim()) params.set("busca", filtrosKanban.busca.trim());
      if (filtrosKanban.tipoStatusIds?.length) params.set("tipoStatusId", filtrosKanban.tipoStatusIds.join(","));
      if (filtrosKanban.clienteIds?.length) params.set("clienteId", filtrosKanban.clienteIds.join(","));
      if (filtrosKanban.responsavelIds?.length) params.set("responsavelId", filtrosKanban.responsavelIds.join(","));
      if (filtrosKanban.dataInicio) params.set("dataInicio", filtrosKanban.dataInicio);
      if (filtrosKanban.dataFim) params.set("dataFim", filtrosKanban.dataFim);
      if (filtrosKanban.arquivado) params.set("arquivado", "true");
      params.set("statusId", statusId);
      params.set("pagina", String(proximaPagina));

      const pagina = await apiFetch<ListaCasos>(`/api/casos?${params.toString()}`);

      setColunas((atuais) =>
        atuais.map((c) =>
          c.status.id === statusId
            ? {
                ...c,
                casos: [...c.casos, ...pagina.casos],
                pagina: proximaPagina,
                carregandoMais: false,
              }
            : c
        )
      );
    } catch {
      toast.error("Não foi possível carregar mais processos desta coluna.");
      setColunas((atuais) =>
        atuais.map((c) => (c.status.id === statusId ? { ...c, carregandoMais: false } : c))
      );
    }
  }

  function handleDragStart(evento: DragStartEvent) {
    const caso = colunas.flatMap((c) => c.casos).find((item) => item.id === String(evento.active.id));
    setCasoArrastado(caso ?? null);
  }

  async function handleDragEnd(evento: DragEndEvent) {
    setCasoArrastado(null);
    const { active, over } = evento;
    if (!over) return;

    const casoId = String(active.id);
    const novoStatusId = String(over.id);

    const colunaOrigem = colunas.find((c) => c.casos.some((caso) => caso.id === casoId));
    if (!colunaOrigem || colunaOrigem.status.id === novoStatusId) return;

    const caso = colunaOrigem.casos.find((c) => c.id === casoId);
    if (!caso) return;

    const snapshot = colunas;

    // Otimista: o card já muda de coluna antes da resposta do servidor.
    setColunas((atuais) =>
      atuais.map((c) => {
        if (c.status.id === colunaOrigem.status.id) {
          return { ...c, casos: c.casos.filter((item) => item.id !== casoId), total: c.total - 1 };
        }
        if (c.status.id === novoStatusId) {
          return { ...c, casos: [{ ...caso, statusId: novoStatusId }, ...c.casos], total: c.total + 1 };
        }
        return c;
      })
    );

    try {
      await atualizar.mutateAsync({ id: casoId, dados: { statusId: novoStatusId } });
    } catch (erro) {
      setColunas(snapshot);
      toast.error(erro instanceof ApiError ? erro.message : "Não foi possível mover o processo.");
    }
  }

  if (isLoading) {
    return (
      <div className="flex gap-3">
        {Array.from({ length: 4 }).map((_, indice) => (
          <div key={indice} className="w-72 shrink-0">
            <Skeleton className="h-8 w-full" />
            <div className="mt-2 flex flex-col gap-2">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return <p className="p-4 text-sm text-destructive">Não foi possível carregar o kanban.</p>;
  }

  if (colunas.length === 0) {
    const filtroDeColunaAtivo =
      filtros.statusIds.length > 0 || filtros.tipoStatusIds.length > 0;
    return (
      <p className="p-4 text-sm text-muted-foreground">
        {filtroDeColunaAtivo
          ? "Nenhuma coluna corresponde aos filtros de status selecionados."
          : "Nenhum status cadastrado ainda — crie etapas do funil em Configurações."}
      </p>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {colunas.map((coluna) => (
          <ColunaKanbanView
            key={coluna.status.id}
            coluna={coluna}
            onAbrirCaso={onAbrirCaso}
            onCarregarMais={() => carregarMais(coluna.status.id)}
          />
        ))}
      </div>
      <DragOverlay>{casoArrastado ? <CasoCardOverlay caso={casoArrastado} /> : null}</DragOverlay>
    </DndContext>
  );
}

function ColunaKanbanView({
  coluna,
  onAbrirCaso,
  onCarregarMais,
}: {
  coluna: EstadoColuna;
  onAbrirCaso: (caso: CasoDTO) => void;
  onCarregarMais: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.status.id });
  const Icone = MAPA_ICONES_STATUS[coluna.status.icone];
  const temMais = coluna.casos.length < coluna.total;

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-lg border-t-2 transition-colors ${
        isOver ? "bg-accent/50" : ""
      }`}
      style={{
        borderTopColor: coluna.status.cor,
        backgroundColor: isOver
          ? undefined
          : `color-mix(in oklch, ${coluna.status.cor}, transparent 92%)`,
      }}
    >
      <div className="flex items-center gap-1.5 px-2 py-2">
        {Icone ? <Icone className="size-4" style={{ color: coluna.status.cor }} /> : null}
        <span className="text-sm font-medium text-foreground">{coluna.status.nome}</span>
        {coluna.status.descricao ? (
          // Mesma leitura da descrição já usada nos cards do dashboard e no filtro:
          // `delay={0}` sobrescreve os 600ms padrão do Base UI. O ícone só existe
          // quando o status tem descrição cadastrada.
          <Tooltip>
            <TooltipTrigger
              delay={0}
              render={
                <button
                  type="button"
                  aria-label={`Sobre ${coluna.status.nome}`}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                />
              }
            >
              <Info className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent>{coluna.status.descricao}</TooltipContent>
          </Tooltip>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">{coluna.total}</span>
      </div>

      <ScrollArea className="h-[calc(100vh-320px)] min-h-40">
        <div className="flex flex-col gap-2 px-2 pb-2">
          {coluna.casos.length === 0 ? (
            <p className="px-1 py-4 text-center text-xs text-muted-foreground">Nenhum processo aqui.</p>
          ) : (
            coluna.casos.map((caso) => (
              <CasoCard key={caso.id} caso={caso} onClick={() => onAbrirCaso(caso)} />
            ))
          )}

          {temMais ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={coluna.carregandoMais}
              onClick={onCarregarMais}
            >
              {coluna.carregandoMais ? "Carregando..." : "Carregar mais"}
            </Button>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
