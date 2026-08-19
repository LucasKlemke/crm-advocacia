"use client";

import { toast } from "sonner";
import { Banknote, ExternalLink, History, Tag, User, Users } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { formatarDataHoraCurta } from "@/lib/utils/data";
import { formatarValorBrl } from "@/lib/utils/valor";
import { useAtualizarCaso, useCasoFiltroOpcoes, useCasos } from "@/hooks/use-casos";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CasoDTO, FiltrosCasos } from "@/types/caso";

export interface CasosTableProps {
  filtros: FiltrosCasos;
  onFiltrosChange: (filtros: FiltrosCasos) => void;
  onAbrirCaso: (caso: CasoDTO) => void;
}

// Mirror de clientes-table.tsx: paginação, loading skeleton, estados vazio/erro. A
// coluna de status é um Select que dispara PATCH direto na linha (mudança de status
// via tabela, complementar ao drag-and-drop do kanban).
export function CasosTable({ filtros, onFiltrosChange, onAbrirCaso }: CasosTableProps) {
  const { data, isLoading, isError } = useCasos(filtros);
  const { data: opcoes } = useCasoFiltroOpcoes();
  const atualizar = useAtualizarCaso();

  const casos = data?.casos ?? [];
  const total = data?.total ?? 0;
  const porPagina = data?.porPagina ?? 20;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const statusOpcoes = opcoes?.status ?? [];

  function irParaPagina(proxima: number) {
    onFiltrosChange({ ...filtros, pagina: proxima });
  }

  async function alterarStatus(caso: CasoDTO, statusId: string) {
    if (statusId === caso.statusId) return;
    try {
      await atualizar.mutateAsync({ id: caso.id, dados: { statusId } });
      toast.success("Status atualizado.");
    } catch (erro) {
      toast.error(erro instanceof ApiError ? erro.message : "Não foi possível atualizar o status.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10 px-4" />
              <TableHead>Título</TableHead>
              <TableHead>
                <span className="flex items-center gap-1.5">
                  <User aria-hidden className="size-3.5 text-muted-foreground" />
                  Cliente
                </span>
              </TableHead>
              <TableHead>
                <span className="flex items-center gap-1.5">
                  <Users aria-hidden className="size-3.5 text-muted-foreground" />
                  Responsável
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
              <TableHead>Criado em</TableHead>
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
                    <TableCell colSpan={8} className="px-4 py-3">
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              : null}

            {isError ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-6 text-center text-sm text-destructive">
                  Não foi possível carregar os casos.
                </TableCell>
              </TableRow>
            ) : null}

            {!isLoading && !isError && casos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {filtros.busca ? "Nenhum caso encontrado para esta busca." : "Nenhum caso cadastrado ainda."}
                </TableCell>
              </TableRow>
            ) : null}

            {casos.map((caso) => (
              <TableRow key={caso.id} className={caso.arquivado ? "text-muted-foreground" : ""}>
                <TableCell className="px-4">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Abrir ${caso.titulo}`}
                    onClick={() => onAbrirCaso(caso)}
                  >
                    <ExternalLink className="size-4" />
                  </Button>
                </TableCell>
                <TableCell className="max-w-56 truncate py-3 font-medium">{caso.titulo}</TableCell>
                <TableCell className="max-w-40 truncate">{caso.cliente.nome}</TableCell>
                <TableCell className="max-w-40 truncate">
                  {caso.responsavel?.usuario.nome ?? (
                    <span className="text-muted-foreground">Sem responsável</span>
                  )}
                </TableCell>
                <TableCell onClick={(evento) => evento.stopPropagation()}>
                  <Select
                    value={caso.statusId}
                    onValueChange={(valor) => alterarStatus(caso, valor as string)}
                    disabled={atualizar.isPending}
                  >
                    <SelectTrigger size="sm" aria-label={`Status de ${caso.titulo}`}>
                      <SelectValue>
                        {() => (
                          <span className="flex items-center gap-1.5">
                            <span
                              aria-hidden
                              className="size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: caso.status.cor }}
                            />
                            {statusOpcoes.find((s) => s.id === caso.statusId)?.nome ?? caso.status.nome}
                          </span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {statusOpcoes.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          <span
                            aria-hidden
                            className="size-2 rounded-full"
                            style={{ backgroundColor: item.cor }}
                          />
                          {item.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>{formatarValorBrl(caso.valor)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatarDataHoraCurta(caso.createdAt)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatarDataHoraCurta(caso.updatedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPaginas > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Página {filtros.pagina} de {totalPaginas} · {total} caso(s)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={filtros.pagina <= 1}
              onClick={() => irParaPagina(filtros.pagina - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={filtros.pagina >= totalPaginas}
              onClick={() => irParaPagina(filtros.pagina + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
