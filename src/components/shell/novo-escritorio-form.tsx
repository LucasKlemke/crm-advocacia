"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { mascararOab } from "@/lib/utils/oab";
import { mascararTelefone } from "@/lib/utils/telefone";

const inputClassName =
  "h-12 rounded-xl border-transparent bg-muted px-4 text-base shadow-none focus-visible:border-ring focus-visible:bg-background";

export function NovoEscritorioForm() {
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [telefoneWhatsapp, setTelefoneWhatsapp] = useState("");
  const [oabResponsavel, setOabResponsavel] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setCarregando(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      nome: formData.get("nome"),
      oabResponsavel: oabResponsavel || undefined,
      telefoneWhatsapp: telefoneWhatsapp || undefined,
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
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/";
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Informações do escritório</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nome">
            Nome do escritório <span className="text-destructive">*</span>
          </Label>
          <Input
            id="nome"
            name="nome"
            required
            placeholder="ex.: Quintino Advocacia"
            className={inputClassName}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Contato &amp; Registro</h2>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <Label htmlFor="oabResponsavel">
              OAB responsável <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <span className="text-xs text-muted-foreground">Registro do advogado responsável</span>
          </div>
          <InputGroup className="h-12 rounded-xl border-transparent bg-muted shadow-none has-[[data-slot=input-group-control]:focus-visible]:bg-background">
            <InputGroupAddon className="self-stretch border-r border-border pr-3 pl-4 font-medium text-muted-foreground">
              OAB/
            </InputGroupAddon>
            <InputGroupInput
              id="oabResponsavel"
              name="oabResponsavel"
              placeholder="SC 71.025"
              value={oabResponsavel}
              onChange={(event) => setOabResponsavel(mascararOab(event.target.value))}
              className="pl-3 text-base"
            />
          </InputGroup>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <Label htmlFor="telefoneWhatsapp">
              WhatsApp <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <span className="text-xs text-muted-foreground">Usado para receber notificações de novidades do sistema</span>
          </div>
          <Input
            id="telefoneWhatsapp"
            name="telefoneWhatsapp"
            type="tel"
            placeholder="+55 (00) 00000-0000"
            value={telefoneWhatsapp}
            onChange={(event) => setTelefoneWhatsapp(mascararTelefone(event.target.value))}
            className={inputClassName}
          />
        </div>
      </div>

      {erro ? (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={carregando}
        className="mx-auto h-12 min-w-52 rounded-full bg-brand px-8 text-base text-brand-foreground hover:bg-brand/90"
      >
        {carregando ? "Criando..." : "Criar escritório"}
      </Button>
    </form>
  );
}
