"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { ContagemPorTipoStatusDTO } from "@/types/dashboard";

export interface CasosPorTipoStatusChartProps {
  porTipoStatus: ContagemPorTipoStatusDTO[];
}

const config = {
  total: { label: "Processos" },
} satisfies ChartConfig;

// Uma barra por TipoStatus, colorida em runtime com `tipoStatus.cor` — cor de domínio
// configurável pelo tenant, não um token de tema (por isso `fill` direto, e não uma
// entrada em `config` como a série de casos-por-mes-chart.tsx).
export function CasosPorTipoStatusChart({ porTipoStatus }: CasosPorTipoStatusChartProps) {
  const dados = porTipoStatus.map(({ tipoStatus, total }) => ({
    nome: tipoStatus.nome,
    total,
    cor: tipoStatus.cor,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Processos por status</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-64 w-full">
          <BarChart data={dados}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="nome"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={0}
              tick={{ fontSize: 11 }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="total" radius={4}>
              {dados.map((item) => (
                <Cell key={item.nome} fill={item.cor} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
