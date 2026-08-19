"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { RoleMembro } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLES_MEMBRO, labelRole } from "@/lib/utils/role";

export interface ConviteFormProps {
  onSucesso?: () => void;
}

const CARGO_PADRAO: RoleMembro = "padrao";

export function ConviteForm({ onSucesso }: ConviteFormProps = {}) {
  const router = useRouter();
  const [role, setRole] = useState<RoleMembro>(CARGO_PADRAO);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setCarregando(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = { email: formData.get("email"), role };

    try {
      const response = await fetch("/api/convites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setErro(data?.error ?? "Não foi possível enviar o convite.");
        return;
      }

      toast.success("Convite enviado.");
      form.reset();
      setRole(CARGO_PADRAO);
      router.refresh();
      onSucesso?.();
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-mail do colaborador</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="role">Cargo</Label>
        <Select
          value={role}
          onValueChange={(value) => setRole((value as RoleMembro) ?? CARGO_PADRAO)}
        >
          <SelectTrigger id="role" className="w-full">
            {/* Sem children o Base UI mostra o valor cru ("admin"); o label vem do mapa. */}
            <SelectValue>{(valor: RoleMembro | null) => (valor ? labelRole(valor) : "")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ROLES_MEMBRO.map((opcao) => (
              <SelectItem key={opcao} value={opcao}>
                {labelRole(opcao)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {erro ? (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      ) : null}
      <Button type="submit" disabled={carregando}>
        {carregando ? "Convidando..." : "Convidar"}
      </Button>
    </form>
  );
}
