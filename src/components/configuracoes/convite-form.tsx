"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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

export function ConviteForm() {
  const router = useRouter();
  const [role, setRole] = useState("padrao");
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
      router.refresh();
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor="email">E-mail do colaborador</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="role">Papel</Label>
        <Select value={role} onValueChange={(value) => setRole(value ?? "padrao")}>
          <SelectTrigger id="role" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="padrao">padrao</SelectItem>
            <SelectItem value="admin">admin</SelectItem>
            <SelectItem value="owner">owner</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={carregando}>
        {carregando ? "Convidando..." : "Convidar"}
      </Button>
      {erro ? (
        <p role="alert" className="text-sm text-destructive sm:basis-full">
          {erro}
        </p>
      ) : null}
    </form>
  );
}
