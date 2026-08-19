"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NovoEscritorioForm } from "@/components/shell/novo-escritorio-form";

export interface EscritorioOption {
  id: string;
  nome: string;
}

export interface EscritorioSwitcherProps {
  escritorios: EscritorioOption[];
  ativoId: string;
}

// Troca de escritório: POST valida a membership no servidor -> unstable_update grava a
// sessão -> router.refresh() recarrega os Server Components com o novo tenant.
export function EscritorioSwitcher({ escritorios, ativoId }: EscritorioSwitcherProps) {
  const router = useRouter();
  const [trocando, setTrocando] = useState(false);
  const [criarAberto, setCriarAberto] = useState(false);
  const ativo = escritorios.find((escritorio) => escritorio.id === ativoId);

  async function trocarPara(id: string) {
    if (id === ativoId || trocando) return;

    setTrocando(true);
    try {
      const response = await fetch("/api/sessao/escritorio-ativo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escritorioId: id }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast.error(data?.error ?? "Não foi possível trocar de escritório.");
        return;
      }

      router.refresh();
    } finally {
      setTrocando(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              className="gap-2 px-2"
              disabled={trocando}
              aria-label="Selecionar escritório"
            >
              <Building2 className="size-4" />
              <span className="max-w-40 truncate">{ativo?.nome ?? "Selecionar escritório"}</span>
              <ChevronsUpDown className="size-4 text-muted-foreground" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Escritórios</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {escritorios.map((escritorio) => (
              <DropdownMenuItem key={escritorio.id} onClick={() => trocarPara(escritorio.id)}>
                {escritorio.id === ativoId ? (
                  <Check className="size-4" />
                ) : (
                  <span className="size-4" />
                )}
                {escritorio.nome}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCriarAberto(true)}>
              <Plus className="size-4" />
              Criar escritório
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={criarAberto} onOpenChange={setCriarAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar escritório</DialogTitle>
            <DialogDescription>
              Você poderá convidar colegas para este escritório depois.
            </DialogDescription>
          </DialogHeader>
          <NovoEscritorioForm />
        </DialogContent>
      </Dialog>
    </>
  );
}
