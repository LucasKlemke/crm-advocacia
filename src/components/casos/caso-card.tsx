"use client";

import { useDraggable } from "@dnd-kit/core";
import { FileText, MessageSquare, UserRound } from "lucide-react";
import { formatarCpf } from "@/lib/utils/cpf";
import { AvatarIniciais } from "@/components/shared/avatar-iniciais";
import { BadgeValor } from "@/components/shared/badge-valor";
import type { CasoDTO } from "@/types/caso";

export interface CasoCardProps {
  caso: CasoDTO;
  onClick: () => void;
}

function Pill({
  icone: Icone,
  total,
  rotulo,
}: {
  icone: typeof FileText;
  total: number;
  rotulo: string;
}) {
  return (
    <span
      aria-label={`${total} ${rotulo}`}
      className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
    >
      <Icone className="size-3.5" aria-hidden />
      {total}
    </span>
  );
}

// Conteúdo puramente visual, sem os hooks de arraste — reaproveitado tanto pelo card
// normal (dentro da coluna) quanto pelo <DragOverlay> (fora da árvore das colunas, para
// não ser cortado pelo overflow do ScrollArea enquanto arrasta).
function CasoCardConteudo({ caso }: { caso: CasoDTO }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        {caso.valor !== null ? (
          <BadgeValor valor={caso.valor} />
        ) : (
          <span />
        )}
        {/* Tingido com a cor do status do caso (mesmo tratamento da status-table):
            a cor vem do banco, então é style inline e não classe utilitária. */}
        <span
          className="flex min-w-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{
            color: caso.status.cor,
            backgroundColor: `color-mix(in oklch, ${caso.status.cor}, transparent 90%)`,
          }}
        >
          {caso.numeroProcesso ? (
            <>
              {/* Prefixo em nó próprio: mantém o número como texto isolado (busca,
                  cópia e seleção) em vez de embutir "nº" na mesma string. */}
              <span className="opacity-70">nº</span>
              <span className="truncate">{caso.numeroProcesso}</span>
            </>
          ) : (
            "Sem número"
          )}
        </span>
      </div>

      <p className="line-clamp-2 text-sm font-semibold text-foreground">{caso.titulo}</p>

      <div className="flex flex-col gap-0.5">
        <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
          <UserRound data-testid="icone-cliente" aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{caso.cliente.nome}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground/80">{formatarCpf(caso.cliente.cpf)}</p>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        {caso.responsavel ? (
          <AvatarIniciais
            nome={caso.responsavel.usuario.nome}
            avatarUrl={caso.responsavel.usuario.avatarUrl}
            className="size-7 text-[10px]"
          />
        ) : (
          <span className="text-xs text-muted-foreground">Sem responsável</span>
        )}

        <div className="flex items-center gap-1.5">
          <Pill icone={FileText} total={caso.totalDocumentos ?? 0} rotulo="documentos" />
          <Pill icone={MessageSquare} total={caso.totalComentarios ?? 0} rotulo="comentários" />
        </div>
      </div>
    </>
  );
}

// Usado dentro do <DragOverlay> do kanban: mesma aparência do card, mas sem os
// listeners de drag (o overlay já é o elemento que o dnd-kit arrasta).
export function CasoCardOverlay({ caso }: { caso: CasoDTO }) {
  return (
    <div className="flex w-72 cursor-grabbing flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-lg">
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
      aria-label={`Abrir processo ${caso.titulo}`}
      onClick={onClick}
      onKeyDown={(evento) => {
        if (evento.key === "Enter") onClick();
      }}
      className={`flex cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-opacity hover:bg-accent/50 ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <CasoCardConteudo caso={caso} />
    </div>
  );
}
