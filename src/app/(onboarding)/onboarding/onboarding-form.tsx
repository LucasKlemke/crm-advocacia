"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OnboardingForm() {
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setCarregando(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      nome: formData.get("nome"),
      oabResponsavel: formData.get("oabResponsavel") || undefined,
      telefoneWhatsapp: formData.get("telefoneWhatsapp") || undefined,
    };

    try {
      const response = await fetch("/api/escritorios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setErro(data?.error ?? "Não foi possível criar o escritório.");
        return;
      }

      // Navegação forçada (não router.push): a sessão trocou de escritório ativo
      // (unstable_update) e "/" pode ter uma entrada stale no Router Cache do estado
      // anterior — só um reload garante que o shell autenticado leia o tenant certo.
      window.location.href = "/";
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="nome">Nome do escritório</Label>
        <Input id="nome" name="nome" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="oabResponsavel">OAB responsável (opcional)</Label>
        <Input id="oabResponsavel" name="oabResponsavel" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="telefoneWhatsapp">WhatsApp (opcional)</Label>
        <Input id="telefoneWhatsapp" name="telefoneWhatsapp" />
      </div>
      {erro ? (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={carregando}
        className="mt-1 bg-brand text-brand-foreground hover:bg-brand/90"
      >
        {carregando ? "Criando..." : "Criar escritório"}
      </Button>
    </form>
  );
}
