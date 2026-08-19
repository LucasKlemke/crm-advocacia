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

export interface ConviteLinha {
  id: string;
  email: string;
  role: string;
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
        <TableRow>
          <TableHead>E-mail</TableHead>
          <TableHead>Papel</TableHead>
          <TableHead className="w-24" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {convites.map((convite) => (
          <TableRow key={convite.id}>
            <TableCell>{convite.email}</TableCell>
            <TableCell>
              <Badge variant="secondary">{convite.role}</Badge>
            </TableCell>
            <TableCell>
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
