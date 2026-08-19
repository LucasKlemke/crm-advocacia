"use client";

import { useDraggable } from "@dnd-kit/core";
import { formatarDataHoraCurta } from "@/lib/utils/data";
import { formatarValorBrl } from "@/lib/utils/valor";
import { AvatarIniciais } from "@/components/shared/avatar-iniciais";
import type { CasoDTO } from "@/types/caso";

export interface CasoCardProps {
  caso: CasoDTO;
  onClick: () => void;
}

// Conteúdo puramente visual, sem os hooks de arraste — reaproveitado tanto pelo card
// normal (dentro da coluna) quanto pelo <DragOverlay> (fora da árvore das colunas, para
// não ser cortado pelo overflow do ScrollArea enquanto arrasta).
function CasoCardConteudo({ caso }: { caso: CasoDTO }) {
  return (
    <>
      <p className="line-clamp-2 text-sm font-medium text-foreground">{caso.titulo}</p>
      <p className="truncate text-xs text-muted-foreground">{caso.cliente.nome}</p>

      <div className="flex items-center justify-between gap-2 pt-1">
        {caso.responsavel ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AvatarIniciais nome={caso.responsavel.usuario.nome} className="size-5 text-[10px]" />
            <span className="max-w-24 truncate">{caso.responsavel.usuario.nome}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Sem responsável</span>
        )}
        {caso.valor !== null ? (
          <span className="text-xs font-medium text-foreground">
            {formatarValorBrl(caso.valor)}
          </span>
        ) : null}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Atualizado {formatarDataHoraCurta(caso.updatedAt)}
      </p>
    </>
  );
}

// Usado dentro do <DragOverlay> do kanban: mesma aparência do card, mas sem os
// listeners de drag (o overlay já é o elemento que o dnd-kit arrasta).
export function CasoCardOverlay({ caso }: { caso: CasoDTO }) {
  return (
    <div className="flex w-72 cursor-grabbing flex-col gap-2 rounded-lg border border-border bg-card p-3 text-left shadow-lg">
      <CasoCardConteudo caso={caso} />
    </div>
  );
}

// Card arrastável (dnd-kit): a coluna de destino é decidida por `useDroppable` no
// kanban. A aparência do arraste em si é responsabilidade do <DragOverlay> (ver
// CasoCardOverlay) — o elemento original só fica semi-transparente no lugar, sem
// transform, para não ser cortado pelo overflow do ScrollArea da coluna.
export function CasoCard({ caso, onClick }: CasoCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: caso.id,
    data: { caso },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      aria-label={`Abrir caso ${caso.titulo}`}
      onClick={onClick}
      onKeyDown={(evento) => {
        if (evento.key === "Enter") onClick();
      }}
      className={`flex cursor-pointer flex-col gap-2 rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-opacity hover:bg-accent/50 ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <CasoCardConteudo caso={caso} />
    </div>
  );
}
