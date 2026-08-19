"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { podeGerenciarMembro, ehAutoAlvo } from "@/lib/auth/permissoes";
import type { RoleMembro } from "@prisma/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export interface MembroLinha {
  id: string;
  role: RoleMembro;
  usuario: { id: string; nome: string; email: string };
}

export interface MembrosTableProps {
  membros: MembroLinha[];
  atorUsuarioId: string;
  atorRole: RoleMembro;
}

const ROLES: RoleMembro[] = ["owner", "admin", "padrao"];

export function MembrosTable({ membros, atorUsuarioId, atorRole }: MembrosTableProps) {
  const router = useRouter();
  const [removendoId, setRemovendoId] = useState<string | null>(null);

  async function alterarRole(membroId: string, role: RoleMembro) {
    const response = await fetch(`/api/membros/${membroId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      toast.error(data?.error ?? "Não foi possível alterar o papel do membro.");
      return;
    }
    toast.success("Papel atualizado.");
    router.refresh();
  }

  async function remover(membroId: string) {
    setRemovendoId(membroId);
    try {
      const response = await fetch(`/api/membros/${membroId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast.error(data?.error ?? "Não foi possível remover o membro.");
        return;
      }
      toast.success("Membro removido.");
      router.refresh();
    } finally {
      setRemovendoId(null);
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>E-mail</TableHead>
          <TableHead>Papel</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {membros.map((membro) => {
          const podeGerenciar =
            podeGerenciarMembro(atorRole, membro.role) &&
            !ehAutoAlvo(atorUsuarioId, membro.usuario.id);

          return (
            <TableRow key={membro.id}>
              <TableCell>{membro.usuario.nome}</TableCell>
              <TableCell className="text-muted-foreground">{membro.usuario.email}</TableCell>
              <TableCell>
                {podeGerenciar ? (
                  <Select
                    defaultValue={membro.role}
                    onValueChange={(role) => alterarRole(membro.id, role as RoleMembro)}
                  >
                    <SelectTrigger aria-label={`Papel de ${membro.usuario.nome}`} className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-sm">{membro.role}</span>
                )}
              </TableCell>
              <TableCell>
                {podeGerenciar ? (
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={removendoId === membro.id}
                          aria-label={`Remover ${membro.usuario.nome}`}
                        >
                          Remover
                        </Button>
                      }
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover membro</AlertDialogTitle>
                        <AlertDialogDescription>
                          {membro.usuario.nome} perderá acesso a este escritório.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remover(membro.id)}>
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
