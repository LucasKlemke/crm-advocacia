"use client";

import Link from "next/link";
import { useInstanciasWhatsapp } from "@/hooks/use-instancias-whatsapp";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AvatarIniciais } from "@/components/shared/avatar-iniciais";
import { formatarTelefone } from "@/lib/utils/telefone";
import type { InstanciaWhatsappDTO } from "@/types/instancia-whatsapp";

export interface PassoInstanciaProps {
  instanciaId: string;
  // Devolve nome e foto junto do id: a revisão mostra "por qual instância vai sair" e a
  // prévia do WhatsApp usa a foto no topo da conversa — buscar de novo lá exigiria
  // repetir a query.
  onSelecionar: (instancia: { id: string; nome: string; fotoPerfilUrl: string | null }) => void;
}

// Mesma linha no gatilho e nas opções: foto, nome e número com máscara. Ver a foto e o
// número é o que evita disparar a campanha pelo WhatsApp errado quando o escritório tem
// mais de um número conectado.
function LinhaInstancia({ instancia }: { instancia: InstanciaWhatsappDTO }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <AvatarIniciais
        nome={instancia.nome}
        avatarUrl={instancia.fotoPerfilUrl}
        className="size-9 shrink-0"
      />
      <span className="flex min-w-0 flex-col text-left">
        <span className="truncate font-medium">{instancia.nome}</span>
        <span className="truncate text-xs text-muted-foreground">
          {instancia.numeroConectado
            ? formatarTelefone(instancia.numeroConectado)
            : "Número não identificado"}
        </span>
      </span>
    </span>
  );
}

export function PassoInstancia({ instanciaId, onSelecionar }: PassoInstanciaProps) {
  const { data, isLoading, isError } = useInstanciasWhatsapp();

  // Só instância conectada consegue disparar — o service recusa as demais, então nem
  // aparecem na lista.
  const conectadas = (data?.instancias ?? []).filter(
    (instancia) => instancia.status === "connected"
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold">Instância que vai disparar</h2>
        <p className="text-sm text-muted-foreground">
          As mensagens saem do número de WhatsApp desta instância.
        </p>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Carregando instâncias...</p> : null}

      {isError ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar as instâncias.
        </p>
      ) : null}

      {!isLoading && !isError && conectadas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Nenhuma instância conectada.{" "}
          <Link href="/instancias" className="text-primary hover:underline">
            Conecte um número em Instâncias
          </Link>{" "}
          para poder disparar uma campanha.
        </p>
      ) : null}

      {conectadas.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="instancia">Instância</Label>
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
            {/* h-auto: o gatilho padrão tem altura fixa de uma linha, e aqui cabem foto +
                duas linhas de texto. */}
            <SelectTrigger id="instancia" className="h-auto w-full py-2">
              <SelectValue placeholder="Escolha a instância">
                {(valor) => {
                  const escolhida = conectadas.find((instancia) => instancia.id === valor);
                  if (!escolhida) return "Escolha a instância";
                  return <LinhaInstancia instancia={escolhida} />;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {conectadas.map((instancia) => (
                <SelectItem key={instancia.id} value={instancia.id} className="py-2">
                  <LinhaInstancia instancia={instancia} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
