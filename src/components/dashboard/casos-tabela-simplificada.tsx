"use client";

import { useState } from "react";
import { Banknote, Hash, History, Tag, User } from "lucide-react";
import { formatarDataHoraCurta } from "@/lib/utils/data";
import { formatarValorBrl } from "@/lib/utils/valor";
import { useCasos } from "@/hooks/use-casos";
import { CasoSheet } from "@/components/casos/caso-sheet";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FiltrosCasos, CasoDTO } from "@/types/caso";
import type { RoleMembro } from "@prisma/client";

export interface CasosTabelaSimplificadaProps {
  filtros: FiltrosCasos;
  atorUsuarioId: string;
  atorNome: string;
  atorRole: RoleMembro;
  limite?: number;
}

// Preview enxuto de processos para o dashboard: sem edição inline, sem paginação —
// só as colunas essenciais para leitura rápida. Complementa (não substitui) a
// CasosTable completa que já fica abaixo, no mesmo dashboard. Clicar na linha abre o
// mesmo CasoSheet ("ver") usado em /casos, com o CasoDTO que a linha já tem em mãos —
// sem refetch por id.
export function CasosTabelaSimplificada({
  filtros,
  atorUsuarioId,
  atorNome,
  atorRole,
  limite = 8,
}: CasosTabelaSimplificadaProps) {
  const { data, isLoading, isError } = useCasos(filtros);
  const casos = (data?.casos ?? []).slice(0, limite);
  const [casoAberto, setCasoAberto] = useState<CasoDTO | null>(null);

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-28">
              <span className="flex items-center gap-1.5">
                <Hash aria-hidden className="size-3.5 text-muted-foreground" />
                Nº do processo
              </span>
            </TableHead>
            <TableHead>
              <span className="flex items-center gap-1.5">
                <User aria-hidden className="size-3.5 text-muted-foreground" />
                Cliente
              </span>
            </TableHead>
            <TableHead>
              <span className="flex items-center gap-1.5">
                <Tag aria-hidden className="size-3.5 text-muted-foreground" />
                Status
              </span>
            </TableHead>
            <TableHead>
              <span className="flex items-center gap-1.5">
                <Banknote aria-hidden className="size-3.5 text-muted-foreground" />
                Valor
              </span>
            </TableHead>
            <TableHead>
              <span className="flex items-center gap-1.5">
                <History aria-hidden className="size-3.5 text-muted-foreground" />
                Atualizado em
              </span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 3 }).map((_, indice) => (
                <TableRow key={indice}>
                  <TableCell colSpan={5} className="px-4 py-3">
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            : null}

          {isError ? (
            <TableRow>
              <TableCell colSpan={5} className="px-4 py-6 text-center text-sm text-destructive">
                Não foi possível carregar os processos.
              </TableCell>
            </TableRow>
          ) : null}

          {!isLoading && !isError && casos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhum processo cadastrado ainda.
              </TableCell>
            </TableRow>
          ) : null}

          {casos.map((caso) => (
            <TableRow
              key={caso.id}
              role="button"
              tabIndex={0}
              className="cursor-pointer"
              onClick={() => setCasoAberto(caso)}
              onKeyDown={(evento) => {
                if (evento.key === "Enter") setCasoAberto(caso);
              }}
            >
              <TableCell className="w-28 max-w-28 truncate text-muted-foreground">
                {caso.numeroProcesso ?? "—"}
              </TableCell>
              <TableCell className="max-w-40 truncate">{caso.cliente.nome}</TableCell>
              <TableCell>
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: caso.status.cor }}
                  />
                  {caso.status.nome}
                </span>
              </TableCell>
              <TableCell>{formatarValorBrl(caso.valor)}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatarDataHoraCurta(caso.updatedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <CasoSheet
        modo="ver"
        caso={casoAberto}
        aberto={casoAberto !== null}
        onOpenChange={(aberto) => setCasoAberto(aberto ? casoAberto : null)}
        atorUsuarioId={atorUsuarioId}
        atorNome={atorNome}
        atorRole={atorRole}
      />
    </Card>
  );
}
