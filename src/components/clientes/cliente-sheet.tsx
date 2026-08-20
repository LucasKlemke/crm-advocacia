"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, History, RotateCcw, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { formatarDataHoraCurta } from "@/lib/utils/data";
import { useAcaoEmLoteClientes } from "@/hooks/use-clientes";
import { ClienteDados } from "@/components/clientes/cliente-dados";
import { ClienteForm } from "@/components/clientes/cliente-form";
import { ComentariosPanel } from "@/components/shared/comentarios-panel";
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
  atorNome: string;
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
  atorNome,
  atorRole,
}: ClienteSheetProps) {
  const acaoEmLote = useAcaoEmLoteClientes();
  // A tabela só recarrega depois; enquanto o drawer está aberto, o que foi salvo aqui
  // é a versão mais recente do cadastro.
  const [salvo, setSalvo] = useState<ClienteDTO | null>(null);
  const exibido = salvo?.id === cliente?.id ? salvo : cliente;
  const excluido = exibido?.softDeletedAt != null;

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
                {modo === "criar" ? "Novo cliente" : (exibido?.nome ?? "Cliente")}
                {excluido ? <Badge variant="outline">Excluído</Badge> : null}
              </SheetTitle>
              <SheetDescription>
                {modo === "criar" ? (
                  "Cadastre um cliente do escritório."
                ) : exibido ? (
                  // Datas de contexto: uma linha discreta, não duas frases.
                  <span className="flex flex-wrap items-center gap-x-3 text-[11px]">
                    <span className="flex items-center gap-1">
                      <CalendarPlus aria-hidden className="size-3" />
                      Criado {formatarDataHoraCurta(exibido.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <History aria-hidden className="size-3" />
                      Atualizado {formatarDataHoraCurta(exibido.updatedAt)}
                    </span>
                  </span>
                ) : null}
              </SheetDescription>
            </div>

            {/* Comentários no cabeçalho, no lugar de uma aba: o histórico de contato é o
                que se lê primeiro ao abrir um cliente; os dados mudam bem menos. */}
            {cliente ? (
              <section aria-label="Comentários">
                <ComentariosPanel
                  escopo="cliente"
                  escopoId={cliente.id}
                  atorUsuarioId={atorUsuarioId}
                  atorNome={atorNome}
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
              <ClienteDados key={cliente.id} cliente={cliente} onAtualizado={setSalvo} />
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
