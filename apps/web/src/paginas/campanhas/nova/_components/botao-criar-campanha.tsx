"use client";

import { Circle, CircleCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CLASSE_ITEM_BARRA } from "./barra-acoes";
import type { TarefaCampanha } from "./tarefas-campanha";

export interface BotaoCriarCampanhaProps {
  tarefas: TarefaCampanha[];
  criando: boolean;
  onCriar: () => void;
}

export function BotaoCriarCampanha({ tarefas, criando, onCriar }: BotaoCriarCampanhaProps) {
  const pendentes = tarefas.filter((tarefa) => !tarefa.concluida);
  const bloqueado = pendentes.length > 0;

  const botao = (
    <Button
      type="button"
      // `aria-disabled` e não `disabled`: elemento desabilitado de verdade não emite evento
      // de mouse nem recebe foco, então a tooltip com o checklist nunca apareceria. Quem
      // barra o clique é o handler, e o `aria-disabled` é o que conta o estado para leitor
      // de tela. O `disabled` real fica só para o envio em andamento.
      aria-disabled={bloqueado || undefined}
      disabled={criando}
      className={cn(
        CLASSE_ITEM_BARRA,
        "ml-auto aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-primary"
      )}
      onClick={() => {
        if (!bloqueado) onCriar();
      }}
    >
      <Send />
      {criando ? "Criando..." : "Criar campanha"}
    </Button>
  );

  if (!bloqueado) return botao;

  return (
    <Tooltip>
      {/* `delay={0}`: os 600ms padrão do Base UI atrasariam demais a única explicação de
          por que o botão não responde. */}
      <TooltipTrigger delay={0} render={botao} />
      {/* `role="tooltip"` explícito: o Base UI só liga a bolha ao gatilho por
          `aria-describedby` e deixa a popup sem papel — e um checklist precisa ser
          anunciado como dica do botão. */}
      <TooltipContent
        role="tooltip"
        align="end"
        className="flex w-72 flex-col items-start gap-1.5 py-2"
      >
        <p className="font-medium">
          Falta {pendentes.length} {pendentes.length === 1 ? "item" : "itens"} para criar:
        </p>
        <ul className="flex w-full flex-col gap-1">
          {tarefas.map((tarefa) => (
            <li key={tarefa.id} className="flex items-start gap-1.5">
              {tarefa.concluida ? (
                <CircleCheck aria-hidden className="mt-px size-3.5 shrink-0" />
              ) : (
                <Circle aria-hidden className="mt-px size-3.5 shrink-0" />
              )}
              <span className={cn(tarefa.concluida && "text-muted-foreground line-through")}>
                {tarefa.rotulo}
              </span>{" "}
              {/* O ícone é decorativo; o estado precisa chegar em texto para quem ouve.
                  Espaço em branco entre itens flex não é renderizado, então isto não abre
                  buraco no layout — só separa as palavras no texto lido. */}
              <span className="sr-only">{tarefa.concluida ? "(concluído)" : "(pendente)"}</span>
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
