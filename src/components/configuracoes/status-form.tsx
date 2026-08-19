"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Check, Plus, Save } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  useAtualizarStatus,
  useCriarStatus,
  useTiposStatus,
  type DadosStatusForm,
} from "@/hooks/use-status";
import { CORES_STATUS_PERMITIDAS } from "@/lib/utils/cores-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusIconePicker } from "@/components/configuracoes/status-icone-picker";
import type { StatusDTO } from "@/types/status";

export interface StatusFormProps {
  status?: StatusDTO;
  onSucesso: (status: StatusDTO) => void;
  onCancelar?: () => void;
}

interface Valores {
  nome: string;
  tipoStatusId: string;
  icone: string | null;
  cor: string | null;
  descricao: string;
}

function valoresIniciais(status?: StatusDTO): Valores {
  return {
    nome: status?.nome ?? "",
    tipoStatusId: status?.tipoStatusId ?? "",
    icone: status?.icone ?? null,
    cor: status?.cor ?? null,
    descricao: status?.descricao ?? "",
  };
}

export function StatusForm({ status, onSucesso, onCancelar }: StatusFormProps) {
  const { data: dadosTipos, isLoading: carregandoTipos } = useTiposStatus();
  const criar = useCriarStatus();
  const atualizar = useAtualizarStatus();
  const [valores, setValores] = useState<Valores>(() => valoresIniciais(status));
  const [erro, setErro] = useState<string | null>(null);

  const salvando = criar.isPending || atualizar.isPending;
  const tipos = dadosTipos?.tipos ?? [];

  function alterar<K extends keyof Valores>(campo: K, valor: Valores[K]) {
    setValores((atuais) => ({ ...atuais, [campo]: valor }));
    setErro(null);
  }

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    if (!valores.nome.trim()) {
      setErro("Informe o nome do status.");
      return;
    }
    if (!valores.tipoStatusId) {
      setErro("Selecione o tipo de status.");
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

    const dados: DadosStatusForm = {
      nome: valores.nome,
      tipoStatusId: valores.tipoStatusId,
      icone: valores.icone,
      cor: valores.cor,
      descricao: valores.descricao.trim() || null,
    };

    try {
      const resposta = status
        ? await atualizar.mutateAsync({ id: status.id, dados })
        : await criar.mutateAsync(dados);
      toast.success(status ? "Status atualizado." : "Status criado.");
      onSucesso(resposta.status);
    } catch (erroCapturado) {
      const mensagem =
        erroCapturado instanceof ApiError
          ? erroCapturado.message
          : "Não foi possível salvar o status.";
      setErro(mensagem);
      toast.error(mensagem);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="status-nome">Nome</Label>
        <Input
          id="status-nome"
          name="nome"
          value={valores.nome}
          onChange={(evento) => alterar("nome", evento.target.value)}
          disabled={salvando}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="status-tipo">Tipo de status</Label>
        <Select
          value={valores.tipoStatusId || null}
          onValueChange={(valor) => alterar("tipoStatusId", (valor as string) ?? "")}
          disabled={salvando || carregandoTipos}
        >
          <SelectTrigger id="status-tipo" className="w-full">
            <SelectValue>
              {() => tipos.find((tipo) => tipo.id === valores.tipoStatusId)?.nome ?? ""}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {tipos.map((tipo) => (
              <SelectItem key={tipo.id} value={tipo.id}>
                <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: tipo.cor }} />
                {tipo.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="status-icone">Ícone</Label>
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
        <Label htmlFor="status-descricao">
          Descrição
          <span className="ml-1 text-xs font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id="status-descricao"
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
          {status ? <Save /> : <Plus />}
          {salvando ? "Salvando..." : status ? "Salvar alterações" : "Criar status"}
        </Button>
      </div>
    </form>
  );
}
