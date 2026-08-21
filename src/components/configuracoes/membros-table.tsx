"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { podeGerenciarMembro, ehAutoAlvo } from "@/lib/auth/permissoes";
import type { RoleMembro } from "@prisma/client";
import { ROLES_MEMBRO, corRole, labelRole } from "@/lib/utils/role";
import { AvatarIniciais } from "@/components/shared/avatar-iniciais";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  usuario: {
    id: string;
    nome: string;
    email: string;
    telefone?: string | null;
    avatarUrl?: string | null;
  };
}

export interface MembrosTableProps {
  membros: MembroLinha[];
  atorUsuarioId: string;
  atorRole: RoleMembro;
}

function CargoBadge({ role }: { role: RoleMembro }) {
  const cor = corRole(role);
  return (
    <Badge
      variant="outline"
      className="gap-1.5 font-normal"
      style={{
        borderColor: `color-mix(in oklch, ${cor}, transparent 50%)`,
        color: cor,
        backgroundColor: `color-mix(in oklch, ${cor}, transparent 92%)`,
      }}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: cor }} />
      {labelRole(role)}
    </Badge>
  );
}

export function MembrosTable({ membros, atorUsuarioId, atorRole }: MembrosTableProps) {
  const router = useRouter();
  const [membroParaRemover, setMembroParaRemover] = useState<MembroLinha | null>(null);
  const [removendo, setRemovendo] = useState(false);
  const [nomeMembroExibido, setNomeMembroExibido] = useState("");

  function abrirRemocao(membro: MembroLinha) {
    setNomeMembroExibido(membro.usuario.nome);
    setMembroParaRemover(membro);
  }

  async function alterarRole(membroId: string, role: RoleMembro) {
    try {
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
    } catch {
      toast.error("Não foi possível alterar o papel do membro.");
    }
  }

  async function remover(membroId: string) {
    setRemovendo(true);
    try {
      const response = await fetch(`/api/membros/${membroId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast.error(data?.error ?? "Não foi possível remover o membro.");
        return;
      }
      toast.success("Membro removido.");
      router.refresh();
    } catch {
      toast.error("Não foi possível remover o membro.");
    } finally {
      setRemovendo(false);
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
                    <AvatarIniciais nome={membro.usuario.nome} avatarUrl={membro.usuario.avatarUrl} />
                    <div className="flex flex-col">
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        {membro.usuario.nome}
                        {ehAutoAlvo(atorUsuarioId, membro.usuario.id) ? (
                          <Badge variant="secondary" className="font-normal">
                            Você
                          </Badge>
                        ) : null}
                      </span>
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
                        className="h-auto w-fit gap-1 border-none bg-transparent p-0 shadow-none hover:bg-transparent focus-visible:ring-0 data-[size=default]:h-auto dark:bg-transparent dark:hover:bg-transparent"
                      >
                        <SelectValue>
                          {(valor: RoleMembro | null) => (valor ? <CargoBadge role={valor} /> : null)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES_MEMBRO.map((role) => (
                          <SelectItem key={role} value={role}>
                            <span
                              aria-hidden
                              className="size-1.5 rounded-full"
                              style={{ backgroundColor: corRole(role) }}
                            />
                            {labelRole(role)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <CargoBadge role={membro.role} />
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
                          onClick={() => abrirRemocao(membro)}
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
              {nomeMembroExibido} perderá acesso a este escritório.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={removendo}
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
