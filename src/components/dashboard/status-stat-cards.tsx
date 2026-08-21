import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MAPA_ICONES_STATUS } from "@/components/configuracoes/status-icone-picker";
import { formatarValorBrl } from "@/lib/utils/valor";
import type { ContagemPorTipoStatusDTO } from "@/types/dashboard";

export interface StatusStatCardsProps {
  porTipoStatus: ContagemPorTipoStatusDTO[];
  selecionadosIds: string[];
  onSelect: (contagem: ContagemPorTipoStatusDTO) => void;
}

// Um card por TipoStatus (já vem ordenado por `ordem` do backend, sempre todas as
// categorias) — mesmo padrão de cor dinâmica por `style={{ color }}` já usado no
// kanban (casos-kanban.tsx), pois `cor` é dado de domínio configurável pelo tenant,
// não uma classe Tailwind literal. Cada card mostra o valor em R$ atualmente naquela
// categoria e a % que ele representa sobre a soma de todas as categorias — sempre
// estado atual (soma dos casos hoje naquele status), nunca evolução de funil.
//
// Hover em qualquer card apaga os demais (group-hover no grid, com o próprio card
// restaurando a opacidade via seu :hover). Seleção é multi (clicar alterna dentro/fora
// de `selecionadosIds`) — com um ou mais cards selecionados, os demais ficam apagados
// de forma persistente, mesmo sem hover.
export function StatusStatCards({ porTipoStatus, selecionadosIds, onSelect }: StatusStatCardsProps) {
  const somaValorTotal = porTipoStatus.reduce((acc, contagem) => acc + contagem.valorTotal, 0);
  const temSelecao = selecionadosIds.length > 0;

  return (
    <div className="group/cards grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {porTipoStatus.map((contagem) => {
        const { tipoStatus, valorTotal } = contagem;
        const Icone = MAPA_ICONES_STATUS[tipoStatus.icone];
        const percentual = somaValorTotal > 0 ? (valorTotal / somaValorTotal) * 100 : 0;
        const selecionado = selecionadosIds.includes(tipoStatus.id);
        const cartao = (
          <Card
            size="sm"
            role="button"
            tabIndex={0}
            aria-pressed={selecionado}
            aria-label={`Ver processos de ${tipoStatus.nome}`}
            onClick={() => onSelect(contagem)}
            onKeyDown={(evento) => {
              if (evento.key === "Enter") onSelect(contagem);
            }}
            className={cn(
              "cursor-pointer transition-opacity hover:bg-accent/50",
              !temSelecao
                ? "opacity-100 hover:opacity-100 group-hover/cards:opacity-40"
                : selecionado
                  ? "opacity-100"
                  : "opacity-40"
            )}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 text-muted-foreground">
                {Icone ? <Icone className="size-4" style={{ color: tipoStatus.cor }} /> : null}
                {tipoStatus.nome}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-semibold">{formatarValorBrl(valorTotal)}</span>
              <p className="text-xs text-muted-foreground">{percentual.toFixed(1)}%</p>
            </CardContent>
          </Card>
        );

        if (!tipoStatus.descricao) {
          return <Fragment key={tipoStatus.id}>{cartao}</Fragment>;
        }

        // O card inteiro é o gatilho (não só o título) e `delay={0}` sobrescreve os
        // 600ms padrão do Base UI: a descrição do tipo aparece assim que o mouse entra.
        return (
          <Tooltip key={tipoStatus.id}>
            <TooltipTrigger delay={0} render={cartao} />
            <TooltipContent>{tipoStatus.descricao}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
