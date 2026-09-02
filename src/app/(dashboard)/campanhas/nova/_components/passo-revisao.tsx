"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface DadosRevisao {
  nome: string;
  delayMin: number;
  delayMax: number;
  quandoEnviar: "agora" | "agendar";
  agendadaPara: string;
}

export interface PassoRevisaoProps {
  dados: DadosRevisao;
  totalDestinatarios: number;
  nomeInstancia: string;
  onMudar: <C extends keyof DadosRevisao>(campo: C, valor: DadosRevisao[C]) => void;
}

export function PassoRevisao({
  dados,
  totalDestinatarios,
  nomeInstancia,
  onMudar,
}: PassoRevisaoProps) {
  // Estimativa grosseira só para dar noção de duração: a UAZAPI sorteia um intervalo
  // entre delayMin e delayMax a cada mensagem.
  const minutosEstimados = Math.round(
    (totalDestinatarios * ((dados.delayMin + dados.delayMax) / 2)) / 60
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold">Revisão e disparo</h2>
        <p className="text-sm text-muted-foreground">
          {totalDestinatarios} destinatário(s) pela instância {nomeInstancia}.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="nome-campanha">Nome da campanha</Label>
        <Input
          id="nome-campanha"
          value={dados.nome}
          maxLength={120}
          placeholder="Ex.: Retomada de contato — dezembro"
          onChange={(evento) => onMudar("nome", evento.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="delay-min">Intervalo mínimo (segundos)</Label>
          <Input
            id="delay-min"
            type="number"
            min={1}
            max={600}
            value={dados.delayMin}
            onChange={(evento) => onMudar("delayMin", Number(evento.target.value))}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="delay-max">Intervalo máximo (segundos)</Label>
          <Input
            id="delay-max"
            type="number"
            min={1}
            max={600}
            value={dados.delayMax}
            onChange={(evento) => onMudar("delayMax", Number(evento.target.value))}
          />
        </div>
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        A UAZAPI espera um tempo aleatório entre os dois valores a cada mensagem, para reduzir o
        risco de bloqueio do número. Estimativa: ~{minutosEstimados} minuto(s) de envio.
      </p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="quando-enviar">Quando enviar</Label>
        <Select
          value={dados.quandoEnviar}
          onValueChange={(valor) => onMudar("quandoEnviar", valor as DadosRevisao["quandoEnviar"])}
        >
          <SelectTrigger id="quando-enviar">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="agora">Começar agora</SelectItem>
            <SelectItem value="agendar">Agendar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {dados.quandoEnviar === "agendar" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="agendada-para">Data e hora do disparo</Label>
          <Input
            id="agendada-para"
            type="datetime-local"
            value={dados.agendadaPara}
            onChange={(evento) => onMudar("agendadaPara", evento.target.value)}
          />
        </div>
      ) : null}
    </div>
  );
}
