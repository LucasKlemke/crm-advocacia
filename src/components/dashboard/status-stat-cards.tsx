import { Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MAPA_ICONES_STATUS } from "@/components/configuracoes/status-icone-picker";
import { formatarValorBrl } from "@/lib/utils/valor";
import type { ContagemPorTipoStatusDTO } from "@/types/dashboard";

export interface StatusStatCardsProps {
  porTipoStatus: ContagemPorTipoStatusDTO[];
  valorTotalAberto: number;
  onSelect: (contagem: ContagemPorTipoStatusDTO) => void;
}

// Um card por TipoStatus (já vem ordenado por `ordem` do backend, sempre as 6
// categorias) mais o KPI de valor total em aberto — mesmo padrão de cor dinâmica por
// `style={{ color }}` já usado no kanban (casos-kanban.tsx), pois `cor` é dado de
// domínio configurável pelo tenant, não uma classe Tailwind literal.
export function StatusStatCards({ porTipoStatus, valorTotalAberto, onSelect }: StatusStatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {porTipoStatus.map((contagem) => {
        const { tipoStatus, total, valorTotal } = contagem;
        const Icone = MAPA_ICONES_STATUS[tipoStatus.icone];
        return (
          <Card
            key={tipoStatus.id}
            size="sm"
            role="button"
            tabIndex={0}
            aria-label={`Ver processos de ${tipoStatus.nome}`}
            onClick={() => onSelect(contagem)}
            onKeyDown={(evento) => {
              if (evento.key === "Enter") onSelect(contagem);
            }}
            className="cursor-pointer transition-colors hover:bg-accent/50"
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 text-muted-foreground">
                {Icone ? <Icone className="size-4" style={{ color: tipoStatus.cor }} /> : null}
                {tipoStatus.nome}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-semibold">{total}</span>
              <p className="text-xs text-muted-foreground">{formatarValorBrl(valorTotal)}</p>
            </CardContent>
          </Card>
        );
      })}

      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-muted-foreground">
            <Wallet className="size-4" />
            Valor total em aberto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <span className="text-2xl font-semibold">{formatarValorBrl(valorTotalAberto)}</span>
        </CardContent>
      </Card>
    </div>
  );
}
