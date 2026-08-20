"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { ContagemPorMesDTO } from "@/types/dashboard";

export interface CasosPorMesChartProps {
  porMes: ContagemPorMesDTO[];
}

// Série única (sem cor de domínio por item, ao contrário do gráfico por tipo de
// status) — usa o token de tema `--chart-1` via ChartConfig, como o resto do design
// system faz para cores que não vêm de dado dinâmico do tenant.
const config = {
  total: { label: "Processos criados", color: "var(--chart-1)" },
} satisfies ChartConfig;

function formatarMes(mes: string): string {
  const [ano, mesNumero] = mes.split("-");
  const data = new Date(Number(ano), Number(mesNumero) - 1, 1);
  return data.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

export function CasosPorMesChart({ porMes }: CasosPorMesChartProps) {
  const dados = porMes.map((item) => ({ ...item, mesFormatado: formatarMes(item.mes) }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Processos criados nos últimos 6 meses</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-64 w-full">
          <BarChart data={dados}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="mesFormatado" tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="total" fill="var(--color-total)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
