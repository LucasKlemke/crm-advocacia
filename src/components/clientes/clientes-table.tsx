"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { formatarCpf } from "@/lib/utils/cpf";
import { formatarTelefone } from "@/lib/utils/telefone";
import { useAcaoEmLoteClientes, useClientes } from "@/hooks/use-clientes";
import { ClienteSheet, type ModoSheet } from "@/components/clientes/cliente-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { RoleMembro } from "@prisma/client";
import type { ClienteDTO } from "@/types/cliente";

export interface ClientesTableProps {
  atorUsuarioId: string;
  atorNome: string;
  atorRole: RoleMembro;
}

export function ClientesTable({ atorUsuarioId, atorNome, atorRole }: ClientesTableProps) {
  const [buscaDigitada, setBuscaDigitada] = useState("");
  const [busca, setBusca] = useState("");
  const [incluirExcluidos, setIncluirExcluidos] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [confirmandoDesativacao, setConfirmandoDesativacao] = useState(false);
  const [sheet, setSheet] = useState<{ modo: ModoSheet; cliente: ClienteDTO | null } | null>(null);

  // Debounce: cada tecla digitada não pode virar uma consulta ao banco.
  useEffect(() => {
    const timer = setTimeout(() => {
      setBusca(buscaDigitada);
      setPagina(1);
      setSelecionados([]);
    }, 300);
    return () => clearTimeout(timer);
  }, [buscaDigitada]);

  const filtros = useMemo(
    () => ({ busca, incluirExcluidos, pagina }),
    [busca, incluirExcluidos, pagina]
  );
  const { data, isLoading, isError } = useClientes(filtros);
  const acaoEmLote = useAcaoEmLoteClientes();

  const clientes = useMemo(() => data?.clientes ?? [], [data]);
  const total = data?.total ?? 0;
  const porPagina = data?.porPagina ?? 20;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  const selecionaveis = clientes.filter((cliente) => cliente.softDeletedAt === null);
  const todosSelecionados =
    selecionaveis.length > 0 && selecionaveis.every((c) => selecionados.includes(c.id));

  // Seleção só vale para as linhas visíveis: trocar de página/filtro a descarta.
  function irParaPagina(proxima: number) {
    setPagina(proxima);
    setSelecionados([]);
  }

  function alternarSelecao(id: string) {
    setSelecionados((atual) =>
      atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]
    );
  }

  function alternarTodos() {
    setSelecionados(todosSelecionados ? [] : selecionaveis.map((cliente) => cliente.id));
  }

  async function executarAcao(ids: string[], acao: "desativar" | "restaurar") {
    try {
      const resultado = await acaoEmLote.mutateAsync({ ids, acao });
      const afetados = resultado.desativados ?? resultado.restaurados ?? 0;
      toast.success(
        acao === "desativar"
          ? `${afetados} cliente(s) desativado(s).`
          : `${afetados} cliente(s) restaurado(s).`
      );
      setSelecionados([]);
    } catch (erro) {
      toast.error(erro instanceof ApiError ? erro.message : "Não foi possível concluir a ação.");
    } finally {
      setConfirmandoDesativacao(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Buscar clientes"
              placeholder="Buscar por nome, CPF ou e-mail"
              className="pl-8"
              value={buscaDigitada}
              onChange={(evento) => setBuscaDigitada(evento.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={incluirExcluidos}
              onCheckedChange={(marcado) => {
                setIncluirExcluidos(Boolean(marcado));
                setPagina(1);
                setSelecionados([]);
              }}
            />
            Mostrar excluídos
          </label>
          <Button onClick={() => setSheet({ modo: "criar", cliente: null })}>
            <Plus />
            Criar novo cliente
          </Button>

          {/* Some quando não há seleção, mas mora na mesma linha dos demais controles:
              a barra em linha própria empurrava a tabela para baixo a cada clique. */}
          {selecionados.length > 0 ? (
            <div role="region" aria-label="Ações em lote" className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selecionados.length} selecionado(s)
              </span>
              <Button
                variant="destructive"
                disabled={acaoEmLote.isPending}
                onClick={() => setConfirmandoDesativacao(true)}
              >
                <Trash2 />
                Desativar
              </Button>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-10 px-4">
                  <Checkbox
                    aria-label="Selecionar todos os clientes"
                    checked={todosSelecionados}
                    disabled={selecionaveis.length === 0}
                    onCheckedChange={alternarTodos}
                  />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>E-mail</TableHead>
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
                    Não foi possível carregar os clientes.
                  </TableCell>
                </TableRow>
              ) : null}

              {!isLoading && !isError && clientes.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    {busca
                      ? "Nenhum cliente encontrado para esta busca."
                      : "Nenhum cliente cadastrado ainda."}
                  </TableCell>
                </TableRow>
              ) : null}

              {clientes.map((cliente) => {
                const excluido = cliente.softDeletedAt !== null;

                return (
                  <TableRow
                    key={cliente.id}
                    tabIndex={0}
                    aria-label={`Abrir ${cliente.nome}`}
                    onClick={() => setSheet({ modo: "ver", cliente })}
                    onKeyDown={(evento) => {
                      if (evento.key === "Enter") setSheet({ modo: "ver", cliente });
                    }}
                    className={`cursor-pointer ${excluido ? "text-muted-foreground" : ""}`}
                  >
                    {/* A seleção em lote convive com a linha clicável: marcar o checkbox
                        não pode abrir o drawer. */}
                    <TableCell className="px-4" onClick={(evento) => evento.stopPropagation()}>
                      <Checkbox
                        aria-label={`Selecionar ${cliente.nome}`}
                        checked={selecionados.includes(cliente.id)}
                        disabled={excluido}
                        onCheckedChange={() => alternarSelecao(cliente.id)}
                      />
                    </TableCell>
                    <TableCell className="py-3 font-medium">
                      <span className="flex items-center gap-2">
                        {cliente.nome}
                        {excluido ? (
                          <Badge variant="outline" className="font-normal">
                            Excluído
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell>{formatarCpf(cliente.cpf)}</TableCell>
                    <TableCell>{cliente.telefone ? formatarTelefone(cliente.telefone) : "–"}</TableCell>
                    <TableCell>{cliente.email ?? "–"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {totalPaginas > 1 ? (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Página {pagina} de {totalPaginas} · {total} cliente(s)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagina <= 1}
                onClick={() => irParaPagina(pagina - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagina >= totalPaginas}
                onClick={() => irParaPagina(pagina + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <AlertDialog open={confirmandoDesativacao} onOpenChange={setConfirmandoDesativacao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar cliente(s)</AlertDialogTitle>
            <AlertDialogDescription>
              {selecionados.length} cliente(s) sairão da listagem, mas o cadastro e o histórico
              são preservados e podem ser restaurados depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={acaoEmLote.isPending}
              onClick={() => executarAcao(selecionados, "desativar")}
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ClienteSheet
        modo={sheet?.modo ?? "criar"}
        cliente={sheet?.cliente ?? null}
        aberto={sheet !== null}
        onOpenChange={(aberto) => setSheet(aberto ? sheet : null)}
        atorUsuarioId={atorUsuarioId}
        atorNome={atorNome}
        atorRole={atorRole}
      />
    </>
  );
}
