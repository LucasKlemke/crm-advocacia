import { useState } from "react";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { trocarEscritorio } from "@/lib/sessao";
import { ApiError } from "@/lib/api-client";
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

// Troca de escritório: trocarEscritorio valida a membership no servidor (RN19) e
// atualiza a sessão. O novo escritorioId remonta o QueryProvider da RotaProtegida,
// que descarta o cache do tenant anterior.
export function EscritorioSwitcher({ escritorios, ativoId }: EscritorioSwitcherProps) {
  const [trocando, setTrocando] = useState(false);
  const [criarAberto, setCriarAberto] = useState(false);
  const ativo = escritorios.find((escritorio) => escritorio.id === ativoId);

  async function trocarPara(id: string) {
    if (id === ativoId || trocando) return;

    setTrocando(true);
    try {
      await trocarEscritorio(id);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Não foi possível trocar de escritório."
      );
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
