"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SenhaForm() {
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setCarregando(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      senhaAtual: formData.get("senhaAtual"),
      novaSenha: formData.get("novaSenha"),
    };

    try {
      const response = await fetch("/api/perfil/senha", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setErro(data?.error ?? "Não foi possível alterar a senha.");
        return;
      }

      toast.success("Senha alterada.");
      form.reset();
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="senhaAtual">Senha atual</Label>
        <Input id="senhaAtual" name="senhaAtual" type="password" autoComplete="current-password" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="novaSenha">Nova senha</Label>
        <Input
          id="novaSenha"
          name="novaSenha"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      {erro ? (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      ) : null}
      <Button type="submit" disabled={carregando} className="self-start">
        {carregando ? "Salvando..." : "Alterar senha"}
      </Button>
    </form>
  );
}
