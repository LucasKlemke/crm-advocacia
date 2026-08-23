"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { useExcluirTipoProcesso, useTiposProcesso } from "@/hooks/use-tipos-processo";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { TipoProcessoForm } from "@/components/configuracoes/tipo-processo-form";
import { MAPA_ICONES_STATUS } from "@/components/configuracoes/status-icone-picker";
import type { TipoProcessoDTO } from "@/types/tipo-processo";

export interface TipoProcessoTableProps {
  somenteLeitura: boolean;
}

export function TipoProcessoTable({ somenteLeitura }: TipoProcessoTableProps) {
  const { data, isLoading, isError } = useTiposProcesso();
  const excluir = useExcluirTipoProcesso();

  const [tipoEmEdicao, setTipoEmEdicao] = useState<TipoProcessoDTO | null>(null);
  const [criando, setCriando] = useState(false);
  const [tipoParaExcluir, setTipoParaExcluir] = useState<TipoProcessoDTO | null>(null);

  const tipos = data?.tipos ?? [];

  async function confirmarExclusao() {
    if (!tipoParaExcluir) return;
    try {
      await excluir.mutateAsync(tipoParaExcluir.id);
      toast.success("Tipo de processo excluído.");
    } catch (erro) {
      toast.error(
        erro instanceof ApiError ? erro.message : "Não foi possível excluir o tipo de processo."
      );
    } finally {
      setTipoParaExcluir(null);
    }
  }

  if (isLoading) {
    return <p className="p-4 text-sm text-muted-foreground">Carregando...</p>;
  }

  if (isError) {
    return (
      <p className="p-4 text-sm text-destructive">
        Não foi possível carregar os tipos de processo.
      </p>
    );
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Tipos de processo</h1>
          <p className="text-sm text-muted-foreground">
            Padronize a natureza dos processos do seu escritório — todo processo é de um tipo.
          </p>
        </div>
        {!somenteLeitura ? (
          <Button onClick={() => setCriando(true)}>
            <Plus />
            Novo tipo
          </Button>
        ) : null}
      </div>

      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="px-4">Tipo</TableHead>
              <TableHead>Descrição</TableHead>
              {!somenteLeitura ? <TableHead className="w-20 px-4" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tipos.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={somenteLeitura ? 2 : 3}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Nenhum tipo de processo cadastrado ainda.
                </TableCell>
              </TableRow>
            ) : (
              tipos.map((item) => {
                const Icone = MAPA_ICONES_STATUS[item.icone];
                return (
                  <TableRow key={item.id}>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: item.cor }}
                        />
                        {Icone ? <Icone className="size-4 text-muted-foreground" /> : null}
                        <span className="font-medium text-foreground">{item.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.descricao ?? "–"}
                    </TableCell>
                    {!somenteLeitura ? (
                      <TableCell className="px-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Editar ${item.nome}`}
                            onClick={() => setTipoEmEdicao(item)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Excluir ${item.nome}`}
                            onClick={() => setTipoParaExcluir(item)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={criando} onOpenChange={setCriando}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Novo tipo de processo</SheetTitle>
            <SheetDescription>
              Crie um tipo para padronizar os processos do escritório.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4">
            <TipoProcessoForm
              onSucesso={() => setCriando(false)}
              onCancelar={() => setCriando(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={tipoEmEdicao !== null} onOpenChange={(open) => !open && setTipoEmEdicao(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Editar tipo de processo</SheetTitle>
            <SheetDescription>Atualize os dados deste tipo.</SheetDescription>
          </SheetHeader>
          <div className="px-4">
            {tipoEmEdicao ? (
              <TipoProcessoForm
                tipo={tipoEmEdicao}
                onSucesso={() => setTipoEmEdicao(null)}
                onCancelar={() => setTipoEmEdicao(null)}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={tipoParaExcluir !== null}
        onOpenChange={(open) => {
          if (!open) setTipoParaExcluir(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tipo de processo</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O tipo &quot;{tipoParaExcluir?.nome}&quot; será
              removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={excluir.isPending} onClick={confirmarExclusao}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
