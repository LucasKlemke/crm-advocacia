"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { labelRole } from "@/lib/utils/role";
import { AvatarIniciais } from "@/components/configuracoes/avatar-iniciais";
import type { RoleMembro } from "@prisma/client";

export interface ConviteLinha {
  id: string;
  email: string;
  role: RoleMembro;
}

export function ConvitesTable({ convites }: { convites: ConviteLinha[] }) {
  const router = useRouter();
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);

  async function cancelar(id: string) {
    setCancelandoId(id);
    try {
      const response = await fetch(`/api/convites/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast.error(data?.error ?? "Não foi possível cancelar o convite.");
        return;
      }
      toast.success("Convite cancelado.");
      router.refresh();
    } catch {
      toast.error("Não foi possível cancelar o convite.");
    } finally {
      setCancelandoId(null);
    }
  }

  if (convites.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum convite pendente.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="px-4">E-mail</TableHead>
          <TableHead>Cargo</TableHead>
          <TableHead className="px-4 text-right" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {convites.map((convite) => (
          <TableRow key={convite.id}>
            <TableCell className="px-4 py-3">
              <div className="flex items-center gap-3">
                <AvatarIniciais nome={convite.email} />
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{convite.email}</span>
                  <Badge variant="outline" className="border-brand/30 text-brand">
                    Convidado
                  </Badge>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="font-normal">
                {labelRole(convite.role)}
              </Badge>
            </TableCell>
            <TableCell className="px-4 text-right">
              <Button
                variant="ghost"
                size="sm"
                disabled={cancelandoId === convite.id}
                onClick={() => cancelar(convite.id)}
              >
                Cancelar
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
