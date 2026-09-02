"use client";

import Link from "next/link";
import { Smartphone } from "lucide-react";
import { useInstanciasWhatsapp } from "@/hooks/use-instancias-whatsapp";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { AvatarIniciais } from "@/components/shared/avatar-iniciais";
import { cn } from "@/lib/utils";
import { formatarTelefone } from "@/lib/utils/telefone";
import type { InstanciaWhatsappDTO } from "@/types/instancia-whatsapp";
import { CLASSE_ITEM_BARRA } from "./barra-acoes";

export interface InstanciaEscolhida {
  id: string;
  nome: string;
  fotoPerfilUrl: string | null;
}

export interface SeletorInstanciaProps {
  instanciaId: string;
  // Devolve nome e foto junto do id: a prévia do WhatsApp usa a foto no topo da conversa,
  // e buscar de novo lá exigiria repetir a query.
  onSelecionar: (instancia: InstanciaEscolhida) => void;
}

// Foto, nome e número com máscara. Ver a foto e o número é o que evita disparar a campanha
// pelo WhatsApp errado quando o escritório tem mais de um número conectado. Tudo numa linha
// só para a pílula caber na mesma altura das outras da barra de ações.
function LinhaInstancia({ instancia }: { instancia: InstanciaWhatsappDTO }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <AvatarIniciais
        nome={instancia.nome}
        avatarUrl={instancia.fotoPerfilUrl}
        className="size-6 shrink-0 text-[0.65rem]"
      />
      <span className="truncate font-medium">{instancia.nome}</span>
      <span className="truncate text-xs text-muted-foreground">
        {instancia.numeroConectado
          ? formatarTelefone(instancia.numeroConectado)
          : "Número não identificado"}
      </span>
    </span>
  );
}

export function SeletorInstancia({ instanciaId, onSelecionar }: SeletorInstanciaProps) {
  const { data, isLoading, isError } = useInstanciasWhatsapp();

  // Só instância conectada consegue disparar — o service recusa as demais, então nem
  // aparecem na lista.
  const conectadas = (data?.instancias ?? []).filter(
    (instancia) => instancia.status === "connected"
  );
  const selecionada = conectadas.find((instancia) => instancia.id === instanciaId);

  if (isLoading) {
    return (
      <span
        className={cn(
          CLASSE_ITEM_BARRA,
          "flex items-center rounded-lg border border-border text-sm text-muted-foreground"
        )}
      >
        Carregando instâncias...
      </span>
    );
  }

  if (isError) {
    return (
      <span
        role="alert"
        className={cn(
          CLASSE_ITEM_BARRA,
          "flex items-center rounded-lg border border-destructive/40 text-sm text-destructive"
        )}
      >
        Falha ao carregar instâncias
      </span>
    );
  }

  if (conectadas.length === 0) {
    return (
      <Link
        href="/instancias"
        className={cn(
          CLASSE_ITEM_BARRA,
          "flex items-center gap-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:bg-muted/40"
        )}
      >
        <Smartphone className="size-4" />
        Conectar um número
      </Link>
    );
  }

  return (
    <Select
      value={instanciaId}
      onValueChange={(id) => {
        const escolhida = conectadas.find((instancia) => instancia.id === id);
        if (escolhida) {
          onSelecionar({
            id: escolhida.id,
            nome: escolhida.nome,
            fotoPerfilUrl: escolhida.fotoPerfilUrl,
          });
        }
      }}
    >
      {/* O conteúdo vai direto no gatilho, e não dentro de um SelectValue: o SelectTrigger
          aplica `line-clamp-1` nesse slot, que vira `display:-webkit-box` e desmonta o layout
          de foto + texto. A altura é repetida na variante `data-[size=default]:` porque a
          classe padrão do SelectTrigger também é prefixada — um `h-10` solto não a venceria. */}
      <SelectTrigger
        aria-label="Instância que vai disparar"
        className={cn(CLASSE_ITEM_BARRA, "min-w-56 pl-2 data-[size=default]:h-10")}
      >
        {selecionada ? (
          <LinhaInstancia instancia={selecionada} />
        ) : (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Smartphone className="size-4" />
            Selecionar conexão
          </span>
        )}
      </SelectTrigger>
      <SelectContent>
        {conectadas.map((instancia) => (
          <SelectItem key={instancia.id} value={instancia.id} className="py-2">
            <LinhaInstancia instancia={instancia} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
