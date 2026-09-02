"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useCampanha } from "@/hooks/use-campanhas";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatarTelefone } from "@/lib/utils/telefone";
import { StatusBadgeCampanha } from "../../_components/status-badge-campanha";

export interface DetalheCampanhaProps {
  campanhaId: string;
}

function Metrica({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="text-lg font-semibold">{valor}</p>
    </div>
  );
}

export function DetalheCampanha({ campanhaId }: DetalheCampanhaProps) {
  const [pagina, setPagina] = useState(1);
  const { data, isLoading, isError } = useCampanha(campanhaId, pagina);

  if (isLoading) {
    return <p className="p-4 text-sm text-muted-foreground">Carregando...</p>;
  }

  if (isError || !data) {
    return <p className="p-4 text-sm text-destructive">Não foi possível carregar a campanha.</p>;
  }

  const { campanha, itens, total, porPagina } = data;
  const ultimaPagina = Math.max(1, Math.ceil(total / porPagina));
  const mapeamento = Object.entries(campanha.mapeamentoVariaveis ?? {});

  return (
    <>
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="self-start" render={<Link href="/campanhas" />}>
          <ArrowLeft />
          Campanhas
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{campanha.nome}</h1>
            <p className="text-sm text-muted-foreground">
              {campanha.instancia?.nome ?? "Instância removida"} · {campanha.totalDestinatarios}{" "}
              destinatário(s) · intervalo de {campanha.delayMin}s a {campanha.delayMax}s
            </p>
          </div>
          <StatusBadgeCampanha status={campanha.status} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Metrica rotulo="Na fila" valor={campanha.logTotal} />
        <Metrica rotulo="Enviadas" valor={campanha.logSucesso} />
        <Metrica rotulo="Entregues" valor={campanha.logEntregue} />
        <Metrica rotulo="Lidas" valor={campanha.logLido} />
        <Metrica rotulo="Falhas" valor={campanha.logFalha} />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Mensagem-modelo</h2>
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
          {campanha.mensagemTemplate}
        </p>
        {mapeamento.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Variáveis:{" "}
            {mapeamento
              .map(([variavel, coluna]) => `{{${variavel}}} → coluna "${coluna}"`)
              .join(" · ")}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Destinatários</h2>
        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-16 px-4">Linha</TableHead>
                <TableHead className="w-56">Número</TableHead>
                <TableHead className="px-4">Mensagem enviada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="px-4 py-2 text-sm text-muted-foreground">
                    {item.linha}
                  </TableCell>
                  <TableCell className="py-2 text-sm">{formatarTelefone(item.numero)}</TableCell>
                  <TableCell className="px-4 py-2 text-sm whitespace-pre-wrap">
                    {item.mensagem}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {ultimaPagina > 1 ? (
          <div className="flex items-center justify-end gap-2">
            <span className="text-sm text-muted-foreground">
              Página {pagina} de {ultimaPagina}
            </span>
            <Button
              variant="outline"
              size="sm"
              aria-label="Página anterior"
              disabled={pagina === 1}
              onClick={() => setPagina((atual) => atual - 1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-label="Próxima página"
              disabled={pagina >= ultimaPagina}
              onClick={() => setPagina((atual) => atual + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}
