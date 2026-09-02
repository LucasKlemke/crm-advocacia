"use client";

import { CalendarClock, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CLASSE_ITEM_BARRA } from "./barra-acoes";

export interface ConfigEnvio {
  delayMin: number;
  delayMax: number;
  quandoEnviar: "agora" | "agendar";
  agendadaPara: string;
}

export interface PopoverEnvioProps {
  valor: ConfigEnvio;
  totalDestinatarios: number;
  onMudar: <C extends keyof ConfigEnvio>(campo: C, valor: ConfigEnvio[C]) => void;
}

// Só apresentação do agendamento no rótulo do botão — a data crua do input
// datetime-local ("2026-03-01T09:30") não se lê bem numa pílula.
function rotularAgendamento(iso: string): string {
  if (!iso) return "Agendar";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "Agendar";
  return data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function PopoverIntervalo({ valor, totalDestinatarios, onMudar }: PopoverEnvioProps) {
  // Estimativa grosseira só para dar noção de duração: a UAZAPI sorteia um intervalo
  // entre delayMin e delayMax a cada mensagem.
  const minutos = Math.round(
    (totalDestinatarios * ((valor.delayMin + valor.delayMax) / 2)) / 60
  );
  const invertido = valor.delayMax < valor.delayMin;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={CLASSE_ITEM_BARRA}
            aria-label="Intervalo entre mensagens"
          />
        }
      >
        <Timer />
        Intervalo: {valor.delayMin}–{valor.delayMax}s
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delay-min" className="text-xs">
                Mínimo (s)
              </Label>
              <Input
                id="delay-min"
                type="number"
                min={1}
                max={600}
                value={valor.delayMin}
                onChange={(evento) => onMudar("delayMin", Number(evento.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delay-max" className="text-xs">
                Máximo (s)
              </Label>
              <Input
                id="delay-max"
                type="number"
                min={1}
                max={600}
                value={valor.delayMax}
                onChange={(evento) => onMudar("delayMax", Number(evento.target.value))}
              />
            </div>
          </div>
          {invertido ? (
            <p role="alert" className="text-xs text-destructive">
              O máximo precisa ser maior ou igual ao mínimo.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              A UAZAPI espera um tempo aleatório entre os dois valores a cada mensagem, para
              reduzir o risco de bloqueio do número.
              {totalDestinatarios > 0 ? ` Estimativa: ~${minutos} min de envio.` : ""}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function PopoverAgendamento({ valor, onMudar }: Omit<PopoverEnvioProps, "totalDestinatarios">) {
  const agendado = valor.quandoEnviar === "agendar";

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={CLASSE_ITEM_BARRA}
            aria-label="Quando enviar"
          />
        }
      >
        <CalendarClock />
        {agendado ? rotularAgendamento(valor.agendadaPara) : "Enviar agora"}
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={agendado ? "outline" : "default"}
              size="sm"
              className="flex-1"
              onClick={() => onMudar("quandoEnviar", "agora")}
            >
              Agora
            </Button>
            <Button
              type="button"
              variant={agendado ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => onMudar("quandoEnviar", "agendar")}
            >
              Agendar
            </Button>
          </div>

          {agendado ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agendada-para" className="text-xs">
                Data e hora do disparo
              </Label>
              <Input
                id="agendada-para"
                type="datetime-local"
                value={valor.agendadaPara}
                onChange={(evento) => onMudar("agendadaPara", evento.target.value)}
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              As mensagens entram na fila da UAZAPI assim que a campanha for criada.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
