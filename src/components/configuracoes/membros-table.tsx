"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { podeGerenciarMembro, ehAutoAlvo } from "@/lib/auth/permissoes";
import type { RoleMembro } from "@prisma/client";
import { iniciais } from "@/lib/utils/nome";
import { labelRole } from "@/lib/utils/role";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export interface MembroLinha {
  id: string;
  role: RoleMembro;
  usuario: { id: string; nome: string; email: string; telefone?: string | null };
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
  const [membroParaRemover, setMembroParaRemover] = useState<MembroLinha | null>(null);

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
    toast.success("Cargo atualizado.");
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
      setMembroParaRemover(null);
    }
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="px-4">Usuário</TableHead>
            <TableHead>Cargo</TableHead>
            <TableHead>WhatsApp</TableHead>
            <TableHead className="w-10 px-4" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {membros.map((membro) => {
            const podeGerenciar =
              podeGerenciarMembro(atorRole, membro.role) &&
              !ehAutoAlvo(atorUsuarioId, membro.usuario.id);

            return (
              <TableRow key={membro.id}>
                <TableCell className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8 rounded-full">
                      <AvatarFallback className="rounded-full text-xs">
                        {iniciais(membro.usuario.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{membro.usuario.nome}</span>
                      <span className="text-sm text-muted-foreground">{membro.usuario.email}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {podeGerenciar ? (
                    <Select
                      defaultValue={membro.role}
                      onValueChange={(role) => alterarRole(membro.id, role as RoleMembro)}
                    >
                      <SelectTrigger
                        aria-label={`Cargo de ${membro.usuario.nome}`}
                        className="w-36 rounded-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {labelRole(role)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="font-normal">
                      {labelRole(membro.role)}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {membro.usuario.telefone ?? "–"}
                </TableCell>
                <TableCell className="px-4">
                  {podeGerenciar ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Ações de ${membro.usuario.nome}`}
                          />
                        }
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setMembroParaRemover(membro)}
                        >
                          Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <AlertDialog
        open={membroParaRemover !== null}
        onOpenChange={(open) => {
          if (!open) setMembroParaRemover(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro</AlertDialogTitle>
            <AlertDialogDescription>
              {membroParaRemover?.usuario.nome} perderá acesso a este escritório.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={removendoId !== null}
              onClick={() => membroParaRemover && remover(membroParaRemover.id)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
