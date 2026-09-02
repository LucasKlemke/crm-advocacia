"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Megaphone, Pause, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { useCampanhas, useControlarCampanha, useSincronizarCampanha } from "@/hooks/use-campanhas";
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
import { Button } from "@/components/ui/button";
import { podePausar, podeRetomar } from "./controle-campanha";
import { rotuloInstancia } from "./rotulo-instancia";
import { StatusBadgeCampanha } from "./status-badge-campanha";
import type { CampanhaDTO } from "@/types/campanha";

export interface ListaCampanhasProps {
  somenteLeitura: boolean;
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function ListaCampanhas({ somenteLeitura }: ListaCampanhasProps) {
  const { data, isLoading, isError } = useCampanhas();
  const sincronizar = useSincronizarCampanha();
  const controlar = useControlarCampanha();

  const [excluindo, setExcluindo] = useState<CampanhaDTO | null>(null);

  const campanhas = data?.campanhas ?? [];

  // As mutations são compartilhadas por todas as linhas: sem isolar por `variables`, uma
  // ação numa linha desabilitaria os botões de todas as outras.
  const sincronizandoId = sincronizar.isPending ? sincronizar.variables : undefined;
  const controlandoId = controlar.isPending ? controlar.variables.id : undefined;

  async function handleSincronizar(campanha: CampanhaDTO) {
    try {
      await sincronizar.mutateAsync(campanha.id);
      toast.success("Campanha sincronizada.");
    } catch (erro) {
      toast.error(
        erro instanceof ApiError ? erro.message : "Não foi possível sincronizar a campanha."
      );
    }
  }

  async function handleControlar(campanha: CampanhaDTO, acao: "stop" | "continue") {
    try {
      await controlar.mutateAsync({ id: campanha.id, acao });
      toast.success(acao === "stop" ? "Campanha pausada." : "Campanha retomada.");
    } catch (erro) {
      toast.error(
        erro instanceof ApiError ? erro.message : "Não foi possível alterar a campanha."
      );
    }
  }

  async function handleExcluir() {
    if (!excluindo) return;
    try {
      await controlar.mutateAsync({ id: excluindo.id, acao: "delete" });
      toast.success("Campanha excluída. Mensagens já enviadas não são afetadas.");
      setExcluindo(null);
    } catch (erro) {
      toast.error(erro instanceof ApiError ? erro.message : "Não foi possível excluir a campanha.");
    }
  }

  if (isLoading) {
    return <p className="p-4 text-sm text-muted-foreground">Carregando...</p>;
  }

  if (isError) {
    return <p className="p-4 text-sm text-destructive">Não foi possível carregar as campanhas.</p>;
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Campanhas</h1>
          <p className="text-sm text-muted-foreground">
            Dispare uma mensagem para uma lista de contatos importada de uma planilha, com
            variáveis preenchidas por linha.
          </p>
        </div>
        {!somenteLeitura ? (
          <Button render={<Link href="/campanhas/nova" />}>
            <Plus />
            Nova campanha
          </Button>
        ) : null}
      </div>

      {campanhas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-10 text-center">
          <Megaphone className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">Nenhuma campanha ainda</p>
          <p className="text-sm text-muted-foreground">
            Suba uma planilha com os contatos e escreva a mensagem para criar a primeira.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="px-4">Campanha</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Envios</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead className="px-4 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campanhas.map((campanha) => {
                const ocupada = sincronizandoId === campanha.id || controlandoId === campanha.id;
                return (
                  <TableRow key={campanha.id}>
                    <TableCell className="px-4 py-3">
                      <Link
                        href={`/campanhas/${campanha.id}`}
                        className="font-medium hover:underline"
                      >
                        {campanha.nome}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {rotuloInstancia(campanha.instancia)} ·{" "}
                        {campanha.totalDestinatarios} destinatário(s)
                      </p>
                    </TableCell>
                    <TableCell className="py-3">
                      <StatusBadgeCampanha status={campanha.status} />
                    </TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground">
                      {campanha.logSucesso} enviada(s)
                      {campanha.logFalha > 0 ? ` · ${campanha.logFalha} falha(s)` : ""}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground">
                      {formatarData(campanha.createdAt)}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Sincronizar ${campanha.nome}`}
                          disabled={ocupada}
                          onClick={() => handleSincronizar(campanha)}
                        >
                          {sincronizandoId === campanha.id ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <RefreshCw />
                          )}
                          Sincronizar
                        </Button>
                        {!somenteLeitura && podePausar(campanha.status) ? (
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Pausar ${campanha.nome}`}
                            disabled={ocupada}
                            onClick={() => handleControlar(campanha, "stop")}
                          >
                            <Pause />
                            Pausar
                          </Button>
                        ) : null}
                        {!somenteLeitura && podeRetomar(campanha.status) ? (
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Retomar ${campanha.nome}`}
                            disabled={ocupada}
                            onClick={() => handleControlar(campanha, "continue")}
                          >
                            <Play />
                            Retomar
                          </Button>
                        ) : null}
                        {!somenteLeitura ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Excluir ${campanha.nome}`}
                            disabled={ocupada}
                            onClick={() => setExcluindo(campanha)}
                          >
                            <Trash2 />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={excluindo !== null} onOpenChange={(aberto) => !aberto && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{excluindo?.nome}”?</AlertDialogTitle>
            <AlertDialogDescription>
              As mensagens ainda não enviadas serão canceladas. As que já saíram continuam no
              WhatsApp dos destinatários. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={controlar.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={controlar.isPending} onClick={handleExcluir}>
              Excluir campanha
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
