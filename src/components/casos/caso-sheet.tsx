"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Archive, CalendarPlus, History } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { formatarDataHoraCurta } from "@/lib/utils/data";
import { useArquivarCaso } from "@/hooks/use-casos";
import { CasoDados } from "@/components/casos/caso-dados";
import { CasoForm } from "@/components/casos/caso-form";
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
import type { CasoDTO } from "@/types/caso";

export type ModoSheet = "criar" | "ver";

export interface CasoSheetProps {
  modo: ModoSheet;
  caso: CasoDTO | null;
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  atorUsuarioId: string;
  atorNome: string;
  atorRole: RoleMembro;
}

// Mesma estrutura do ClienteSheet: comentários no cabeçalho, dados abaixo, arquivar
// no rodapé. Sem "desarquivar" — não há endpoint exposto para isso (casoService tem o
// método, mas a rota não o usa), então um caso arquivado só mostra o selo.
export function CasoSheet({
  modo,
  caso,
  aberto,
  onOpenChange,
  atorUsuarioId,
  atorNome,
  atorRole,
}: CasoSheetProps) {
  const arquivar = useArquivarCaso();
  const [salvo, setSalvo] = useState<CasoDTO | null>(null);
  const exibido = salvo?.id === caso?.id ? salvo : caso;
  const arquivado = exibido?.arquivado ?? false;

  async function arquivarCaso() {
    if (!caso) return;
    try {
      await arquivar.mutateAsync(caso.id);
      toast.success("Processo arquivado.");
      onOpenChange(false);
    } catch (erro) {
      toast.error(erro instanceof ApiError ? erro.message : "Não foi possível arquivar o processo.");
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SheetHeader className="gap-3 border-b border-border">
            <div className="flex flex-col gap-0.5">
              <SheetTitle className="flex items-center gap-2">
                {modo === "criar" ? "Novo processo" : (exibido?.titulo ?? "Processo")}
                {arquivado ? <Badge variant="outline">Arquivado</Badge> : null}
              </SheetTitle>
              <SheetDescription>
                {modo === "criar" ? (
                  "Cadastre um processo vinculado a um cliente do escritório."
                ) : exibido ? (
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

            {caso ? (
              <section aria-label="Comentários">
                <ComentariosPanel
                  escopo="caso"
                  escopoId={caso.id}
                  atorUsuarioId={atorUsuarioId}
                  atorNome={atorNome}
                  atorRole={atorRole}
                />
              </section>
            ) : null}
          </SheetHeader>

          <div className="px-4 py-4">
            {modo === "criar" ? (
              <CasoForm onSucesso={() => onOpenChange(false)} onCancelar={() => onOpenChange(false)} />
            ) : caso ? (
              <CasoDados key={caso.id} caso={caso} onAtualizado={setSalvo} />
            ) : null}
          </div>
        </div>

        {caso && !arquivado ? (
          <SheetFooter className="border-t border-border">
            <Button
              variant="destructive"
              size="sm"
              className="self-start"
              disabled={arquivar.isPending}
              onClick={arquivarCaso}
            >
              <Archive />
              Arquivar processo
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
