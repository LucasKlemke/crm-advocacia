"use client";

import { toast } from "sonner";
import { MessageSquare, RotateCcw, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { useAcaoEmLoteClientes } from "@/hooks/use-clientes";
import { ClienteDados } from "@/components/clientes/cliente-dados";
import { ClienteForm } from "@/components/clientes/cliente-form";
import { ComentariosPanel } from "@/components/clientes/comentarios-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { RoleMembro } from "@prisma/client";
import type { ClienteDTO } from "@/types/cliente";

export type ModoSheet = "criar" | "ver";

export interface ClienteSheetProps {
  modo: ModoSheet;
  cliente: ClienteDTO | null;
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  atorUsuarioId: string;
  atorRole: RoleMembro;
}

// Um único drawer serve criação e consulta/edição: no modo criar mostra o formulário
// completo; com um cliente carregado, os comentários ficam no topo (como no Notion) e
// os dados abaixo, editáveis campo a campo.
export function ClienteSheet({
  modo,
  cliente,
  aberto,
  onOpenChange,
  atorUsuarioId,
  atorRole,
}: ClienteSheetProps) {
  const acaoEmLote = useAcaoEmLoteClientes();
  const excluido = cliente?.softDeletedAt != null;

  async function alternarAtivacao() {
    if (!cliente) return;
    const acao = excluido ? "restaurar" : "desativar";
    try {
      await acaoEmLote.mutateAsync({ ids: [cliente.id], acao });
      toast.success(excluido ? "Cliente restaurado." : "Cliente desativado.");
      onOpenChange(false);
    } catch (erro) {
      toast.error(erro instanceof ApiError ? erro.message : "Não foi possível concluir a ação.");
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SheetHeader className="gap-3 border-b border-border">
            <div className="flex flex-col gap-0.5">
              <SheetTitle className="flex items-center gap-2">
                {modo === "criar" ? "Novo cliente" : (cliente?.nome ?? "Cliente")}
                {excluido ? <Badge variant="outline">Excluído</Badge> : null}
              </SheetTitle>
              <SheetDescription>
                {modo === "criar"
                  ? "Cadastre um cliente do escritório."
                  : "Comente o histórico de contato e edite os dados clicando neles."}
              </SheetDescription>
            </div>

            {/* Comentários no cabeçalho, no lugar de uma aba: o histórico de contato é o
                que se lê primeiro ao abrir um cliente; os dados mudam bem menos. */}
            {cliente ? (
              <section aria-label="Comentários" className="flex flex-col gap-2">
                <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <MessageSquare aria-hidden className="size-3.5" />
                  Comentários
                </h3>
                <ComentariosPanel
                  clienteId={cliente.id}
                  atorUsuarioId={atorUsuarioId}
                  atorRole={atorRole}
                />
              </section>
            ) : null}
          </SheetHeader>

          <div className="px-4 py-4">
            {modo === "criar" ? (
              <ClienteForm
                onSucesso={() => onOpenChange(false)}
                onCancelar={() => onOpenChange(false)}
              />
            ) : cliente ? (
              <ClienteDados key={cliente.id} cliente={cliente} />
            ) : null}
          </div>
        </div>

        {cliente ? (
          <SheetFooter className="border-t border-border">
            <Button
              variant={excluido ? "outline" : "destructive"}
              size="sm"
              className="self-start"
              disabled={acaoEmLote.isPending}
              onClick={alternarAtivacao}
            >
              {excluido ? <RotateCcw /> : <Trash2 />}
              {excluido ? "Restaurar cliente" : "Desativar cliente"}
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
