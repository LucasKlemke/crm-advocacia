"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Check, Plus, Save } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  useAtualizarTipoProcesso,
  useCriarTipoProcesso,
  type DadosTipoProcessoForm,
} from "@/hooks/use-tipos-processo";
import { CORES_STATUS_PERMITIDAS } from "@/lib/utils/cores-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusIconePicker } from "@/components/configuracoes/status-icone-picker";
import type { TipoProcessoDTO } from "@/types/tipo-processo";

export interface TipoProcessoFormProps {
  tipo?: TipoProcessoDTO;
  onSucesso: (tipo: TipoProcessoDTO) => void;
  onCancelar?: () => void;
}

interface Valores {
  nome: string;
  icone: string | null;
  cor: string | null;
  descricao: string;
}

function valoresIniciais(tipo?: TipoProcessoDTO): Valores {
  return {
    nome: tipo?.nome ?? "",
    icone: tipo?.icone ?? null,
    cor: tipo?.cor ?? null,
    descricao: tipo?.descricao ?? "",
  };
}

// Mesmo desenho de StatusForm (nome + ícone + cor + descrição), sem o select de tipo:
// TipoProcesso não tem nível global equivalente ao TipoStatus.
export function TipoProcessoForm({ tipo, onSucesso, onCancelar }: TipoProcessoFormProps) {
  const criar = useCriarTipoProcesso();
  const atualizar = useAtualizarTipoProcesso();
  const [valores, setValores] = useState<Valores>(() => valoresIniciais(tipo));
  const [erro, setErro] = useState<string | null>(null);

  const salvando = criar.isPending || atualizar.isPending;

  function alterar<K extends keyof Valores>(campo: K, valor: Valores[K]) {
    setValores((atuais) => ({ ...atuais, [campo]: valor }));
    setErro(null);
  }

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    if (!valores.nome.trim()) {
      setErro("Informe o nome do tipo de processo.");
      return;
    }
    if (!valores.icone) {
      setErro("Selecione um ícone.");
      return;
    }
    if (!valores.cor) {
      setErro("Selecione uma cor.");
      return;
    }

    const dados: DadosTipoProcessoForm = {
      nome: valores.nome,
      icone: valores.icone,
      cor: valores.cor,
      descricao: valores.descricao.trim() || null,
    };

    try {
      const resposta = tipo
        ? await atualizar.mutateAsync({ id: tipo.id, dados })
        : await criar.mutateAsync(dados);
      toast.success(tipo ? "Tipo de processo atualizado." : "Tipo de processo criado.");
      onSucesso(resposta.tipo);
    } catch (erroCapturado) {
      const mensagem =
        erroCapturado instanceof ApiError
          ? erroCapturado.message
          : "Não foi possível salvar o tipo de processo.";
      setErro(mensagem);
      toast.error(mensagem);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="tipo-processo-nome">Nome</Label>
        <Input
          id="tipo-processo-nome"
          name="nome"
          placeholder="Ex.: Juros abusivos"
          value={valores.nome}
          onChange={(evento) => alterar("nome", evento.target.value)}
          disabled={salvando}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="tipo-processo-icone">Ícone</Label>
        <StatusIconePicker
          value={valores.icone}
          onChange={(icone) => alterar("icone", icone)}
          disabled={salvando}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Cor</span>
        <div role="radiogroup" aria-label="Cor" className="flex flex-wrap gap-2">
          {CORES_STATUS_PERMITIDAS.map((cor) => {
            const selecionada = cor === valores.cor;
            return (
              <button
                key={cor}
                type="button"
                role="radio"
                aria-checked={selecionada}
                aria-label={`Cor ${cor}`}
                disabled={salvando}
                onClick={() => alterar("cor", cor)}
                style={{ backgroundColor: cor }}
                className={cn(
                  "flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow disabled:cursor-not-allowed disabled:opacity-50",
                  selecionada ? "ring-2 ring-foreground" : "ring-1 ring-foreground/10"
                )}
              >
                {selecionada ? <Check className="size-3.5 text-white" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="tipo-processo-descricao">
          Descrição
          <span className="ml-1 text-xs font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id="tipo-processo-descricao"
          name="descricao"
          value={valores.descricao}
          onChange={(evento) => alterar("descricao", evento.target.value)}
          disabled={salvando}
        />
      </div>

      {erro ? (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      ) : null}

      <div className="mt-2 flex justify-end gap-2">
        {onCancelar ? (
          <Button type="button" variant="outline" onClick={onCancelar} disabled={salvando}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" disabled={salvando}>
          {tipo ? <Save /> : <Plus />}
          {salvando ? "Salvando..." : tipo ? "Salvar alterações" : "Criar tipo"}
        </Button>
      </div>
    </form>
  );
}
