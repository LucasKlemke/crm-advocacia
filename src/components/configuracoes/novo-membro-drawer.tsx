"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ConviteForm } from "@/components/configuracoes/convite-form";

// Abre um drawer lateral com o formulário de convite; fecha sozinho quando o convite é enviado.
export function NovoMembroDrawer() {
  const [aberto, setAberto] = useState(false);

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger
        render={
          <Button>
            <UserPlus />
            Novo Membro
          </Button>
        }
      />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Convidar colaborador</SheetTitle>
          <SheetDescription>
            Um convite será enviado por e-mail para acesso a este escritório.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <ConviteForm onSucesso={() => setAberto(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
