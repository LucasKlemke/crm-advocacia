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
import { formatarTelefone } from "@/lib/utils/telefone";

export interface PassoInstanciaProps {
  instanciaId: string;
  // Devolve o nome junto do id: a tela de revisão mostra "por qual instância vai sair",
  // e buscar o nome de novo lá exigiria repetir a query.
  onSelecionar: (instancia: { id: string; nome: string }) => void;
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
              if (escolhida) onSelecionar({ id: escolhida.id, nome: escolhida.nome });
            }}
          >
            <SelectTrigger id="instancia">
              <SelectValue placeholder="Escolha a instância" />
            </SelectTrigger>
            <SelectContent>
              {conectadas.map((instancia) => (
                <SelectItem key={instancia.id} value={instancia.id}>
                  {instancia.nome}
                  {instancia.numeroConectado
                    ? ` — ${formatarTelefone(instancia.numeroConectado)}`
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
