"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, MessageCircle, Scale } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { mascararOab } from "@/lib/utils/oab";
import { mascararTelefone } from "@/lib/utils/telefone";

export interface EscritorioFormProps {
  escritorio: { nome: string; oabResponsavel: string | null; telefoneWhatsapp: string | null };
  somenteLeitura: boolean;
}

// Somente owner/admin editam (RN — role padrao só lê); o form fica desabilitado nesse caso.
export function EscritorioForm({ escritorio, somenteLeitura }: EscritorioFormProps) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  // OAB e WhatsApp são controlados para receber a mesma máscara progressiva do
  // onboarding (NovoEscritorioForm) — o valor já salvo é remascarado na montagem,
  // então um registro gravado antes da máscara também aparece formatado.
  const [oabResponsavel, setOabResponsavel] = useState(() =>
    mascararOab(escritorio.oabResponsavel ?? "")
  );
  const [telefoneWhatsapp, setTelefoneWhatsapp] = useState(() =>
    mascararTelefone(escritorio.telefoneWhatsapp ?? "")
  );

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
      oabResponsavel: oabResponsavel.trim(),
      telefoneWhatsapp: telefoneWhatsapp.trim(),
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
        <Label htmlFor="nome">
          <Building2 aria-hidden className="size-3.5 text-muted-foreground" />
          Nome do escritório
        </Label>
        <Input id="nome" name="nome" defaultValue={escritorio.nome} disabled={somenteLeitura} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="oabResponsavel">
          <Scale aria-hidden className="size-3.5 text-muted-foreground" />
          OAB responsável
        </Label>
        {/* Prefixo "OAB/" fixo fora do campo, como no onboarding: o usuário digita
            só a UF e o número, que a máscara formata em milhar (ex.: "SC 71.025"). */}
        <InputGroup>
          <InputGroupAddon className="self-stretch border-r border-border pr-3 pl-3 font-medium text-muted-foreground">
            OAB/
          </InputGroupAddon>
          <InputGroupInput
            id="oabResponsavel"
            name="oabResponsavel"
            placeholder="SC 71.025"
            value={oabResponsavel}
            onChange={(event) => setOabResponsavel(mascararOab(event.target.value))}
            disabled={somenteLeitura}
          />
        </InputGroup>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="telefoneWhatsapp">
          <MessageCircle aria-hidden className="size-3.5 text-muted-foreground" />
          WhatsApp
        </Label>
        <Input
          id="telefoneWhatsapp"
          name="telefoneWhatsapp"
          type="tel"
          placeholder="+55 (00) 00000-0000"
          value={telefoneWhatsapp}
          onChange={(event) => setTelefoneWhatsapp(mascararTelefone(event.target.value))}
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
