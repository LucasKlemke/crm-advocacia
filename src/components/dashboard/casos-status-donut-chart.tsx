"use client";

import { Cell, Pie, PieChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { ContagemPorTipoStatusDTO } from "@/types/dashboard";

export interface CasosStatusDonutChartProps {
  porTipoStatus: ContagemPorTipoStatusDTO[];
}

const config = {
  total: { label: "Processos" },
} satisfies ChartConfig;

// Uma fatia por TipoStatus, colorida em runtime com `tipoStatus.cor` — mesmo padrão
// de cor de domínio configurável pelo tenant usado no antigo gráfico de barras que
// este substitui. Legenda é uma lista simples ao lado, e não ChartLegendContent: essa
// só resolve rótulos a partir de `ChartConfig` (chaves fixas em build time), o que não
// serve para os N nomes de TipoStatus configuráveis pelo tenant em runtime.
export function CasosStatusDonutChart({ porTipoStatus }: CasosStatusDonutChartProps) {
  const somaTotal = porTipoStatus.reduce((acc, { total }) => acc + total, 0);
  const dados = porTipoStatus.map(({ tipoStatus, total }) => ({
    nome: tipoStatus.nome,
    total,
    percentual: somaTotal > 0 ? (total / somaTotal) * 100 : 0,
    cor: tipoStatus.cor,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Processos por status</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <ChartContainer config={config} className="mx-auto h-64 w-full max-w-64">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="nome" hideLabel />} />
            <Pie data={dados} dataKey="total" nameKey="nome" innerRadius={56} outerRadius={88} strokeWidth={2}>
              {dados.map((item) => (
                <Cell key={item.nome} fill={item.cor} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <ul className="flex flex-col gap-1.5 text-sm">
          {dados.map((item) => (
            <li key={item.nome} className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.cor }} />
              <span className="text-muted-foreground">{item.nome}</span>
              <span className="font-medium tabular-nums">{item.total}</span>
              <span className="text-muted-foreground tabular-nums">
                ({item.percentual.toFixed(1)}%)
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
