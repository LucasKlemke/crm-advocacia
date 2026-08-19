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

// Card arrastável (dnd-kit): a coluna de destino é decidida por `useDroppable` no
// kanban, este componente só precisa se anunciar como draggable.
export function CasoCard({ caso, onClick }: CasoCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: caso.id,
    data: { caso },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
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
    </div>
  );
}
