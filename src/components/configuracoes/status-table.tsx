"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { useExcluirStatus, useStatus, useTiposStatus } from "@/hooks/use-status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { StatusForm } from "@/components/configuracoes/status-form";
import { MAPA_ICONES_STATUS } from "@/components/configuracoes/status-icone-picker";
import type { StatusDTO } from "@/types/status";

export interface StatusTableProps {
  somenteLeitura: boolean;
}

export function StatusTable({ somenteLeitura }: StatusTableProps) {
  const { data, isLoading, isError } = useStatus();
  const { data: dadosTipos } = useTiposStatus();
  const excluir = useExcluirStatus();

  const [statusEmEdicao, setStatusEmEdicao] = useState<StatusDTO | null>(null);
  const [criando, setCriando] = useState(false);
  const [statusParaExcluir, setStatusParaExcluir] = useState<StatusDTO | null>(null);

  const status = data?.status ?? [];
  const mapaTipos = new Map((dadosTipos?.tipos ?? []).map((tipo) => [tipo.id, tipo]));

  async function confirmarExclusao() {
    if (!statusParaExcluir) return;
    try {
      await excluir.mutateAsync(statusParaExcluir.id);
      toast.success("Status excluído.");
    } catch (erro) {
      toast.error(
        erro instanceof ApiError ? erro.message : "Não foi possível excluir o status."
      );
    } finally {
      setStatusParaExcluir(null);
    }
  }

  if (isLoading) {
    return <p className="p-4 text-sm text-muted-foreground">Carregando...</p>;
  }

  if (isError) {
    return <p className="p-4 text-sm text-destructive">Não foi possível carregar os status.</p>;
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Status</h1>
          <p className="text-sm text-muted-foreground">
            Configure as etapas do funil de processos do seu escritório.
          </p>
        </div>
        {!somenteLeitura ? (
          <Button onClick={() => setCriando(true)}>
            <Plus />
            Novo status
          </Button>
        ) : null}
      </div>

      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="px-4">Status</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descrição</TableHead>
              {!somenteLeitura ? <TableHead className="w-20 px-4" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {status.length === 0 ? (
              <TableRow>
                <TableCell colSpan={somenteLeitura ? 3 : 4} className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum status cadastrado ainda.
                </TableCell>
              </TableRow>
            ) : (
              status.map((item) => {
                const Icone = MAPA_ICONES_STATUS[item.icone];
                const tipo = mapaTipos.get(item.tipoStatusId);
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
                    <TableCell>
                      {tipo ? (
                        <Badge
                          variant="outline"
                          className="gap-1.5 font-normal"
                          style={{
                            borderColor: `color-mix(in oklch, ${tipo.cor}, transparent 50%)`,
                            color: tipo.cor,
                            backgroundColor: `color-mix(in oklch, ${tipo.cor}, transparent 92%)`,
                          }}
                        >
                          <span
                            aria-hidden
                            className="size-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: tipo.cor }}
                          />
                          {tipo.nome}
                        </Badge>
                      ) : null}
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
                            onClick={() => setStatusEmEdicao(item)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Excluir ${item.nome}`}
                            onClick={() => setStatusParaExcluir(item)}
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
            <SheetTitle>Novo status</SheetTitle>
            <SheetDescription>Crie uma nova etapa para o funil do escritório.</SheetDescription>
          </SheetHeader>
          <div className="px-4">
            <StatusForm onSucesso={() => setCriando(false)} onCancelar={() => setCriando(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={statusEmEdicao !== null} onOpenChange={(open) => !open && setStatusEmEdicao(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Editar status</SheetTitle>
            <SheetDescription>Atualize os dados desta etapa do funil.</SheetDescription>
          </SheetHeader>
          <div className="px-4">
            {statusEmEdicao ? (
              <StatusForm
                status={statusEmEdicao}
                onSucesso={() => setStatusEmEdicao(null)}
                onCancelar={() => setStatusEmEdicao(null)}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={statusParaExcluir !== null}
        onOpenChange={(open) => {
          if (!open) setStatusParaExcluir(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir status</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O status &quot;{statusParaExcluir?.nome}&quot; será
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
