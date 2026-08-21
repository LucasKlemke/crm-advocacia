"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function campoOpcional(valor: FormDataEntryValue | null): string {
  return typeof valor === "string" ? valor.trim() : "";
}

export interface EscritorioFormProps {
  escritorio: { nome: string; oabResponsavel: string | null; telefoneWhatsapp: string | null };
  somenteLeitura: boolean;
}

// Somente owner/admin editam (RN — role padrao só lê); o form fica desabilitado nesse caso.
export function EscritorioForm({ escritorio, somenteLeitura }: EscritorioFormProps) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setCarregando(true);

    const formData = new FormData(event.currentTarget);
    // Campos opcionais vão como string (vazia inclusive): omitir o campo do JSON faria a
    // API ignorá-lo (schema `.optional()`), e o usuário nunca conseguiria limpar OAB ou
    // WhatsApp — o toast dizia "salvo" sem nada ter mudado.
    const payload = {
      nome: formData.get("nome"),
      oabResponsavel: campoOpcional(formData.get("oabResponsavel")),
      telefoneWhatsapp: campoOpcional(formData.get("telefoneWhatsapp")),
    };

    try {
      const response = await fetch("/api/escritorios/atual", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setErro(data?.error ?? "Não foi possível atualizar o escritório.");
        return;
      }

      toast.success("Escritório atualizado.");
      router.refresh();
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="nome">Nome do escritório</Label>
        <Input id="nome" name="nome" defaultValue={escritorio.nome} disabled={somenteLeitura} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="oabResponsavel">OAB responsável</Label>
        <Input
          id="oabResponsavel"
          name="oabResponsavel"
          defaultValue={escritorio.oabResponsavel ?? ""}
          disabled={somenteLeitura}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="telefoneWhatsapp">WhatsApp</Label>
        <Input
          id="telefoneWhatsapp"
          name="telefoneWhatsapp"
          defaultValue={escritorio.telefoneWhatsapp ?? ""}
          disabled={somenteLeitura}
        />
      </div>
      {erro ? (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      ) : null}
      {!somenteLeitura ? (
        <Button type="submit" disabled={carregando} className="self-start">
          {carregando ? "Salvando..." : "Salvar alterações"}
        </Button>
      ) : null}
    </form>
  );
}
