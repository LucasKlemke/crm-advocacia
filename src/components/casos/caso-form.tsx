"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { useCasoFiltroOpcoes, useCriarCaso, type DadosCasoForm } from "@/hooks/use-casos";
import {
  ICONE_CLIENTE,
  ICONE_DESCRICAO,
  ICONE_RESPONSAVEL,
  ICONE_TITULO,
  ICONE_VALOR,
  SEM_RESPONSAVEL_VALOR,
} from "@/components/casos/campos-caso";
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
import type { CasoDTO } from "@/types/caso";

export interface CasoFormProps {
  onSucesso: (caso: CasoDTO) => void;
  onCancelar?: () => void;
}

interface Valores {
  titulo: string;
  clienteId: string;
  statusId: string;
  responsavelMembroId: string;
  valor: string;
  descricao: string;
}

const VALORES_INICIAIS: Valores = {
  titulo: "",
  clienteId: "",
  statusId: "",
  responsavelMembroId: SEM_RESPONSAVEL_VALOR,
  valor: "",
  descricao: "",
};

export function CasoForm({ onSucesso, onCancelar }: CasoFormProps) {
  const { data: opcoes, isLoading: carregandoOpcoes } = useCasoFiltroOpcoes();
  const criar = useCriarCaso();
  const [valores, setValores] = useState<Valores>(VALORES_INICIAIS);
  const [erro, setErro] = useState<string | null>(null);

  function alterar<K extends keyof Valores>(campo: K, valor: Valores[K]) {
    setValores((atuais) => ({ ...atuais, [campo]: valor }));
    setErro(null);
  }

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    if (!valores.titulo.trim()) {
      setErro("Informe o título do caso.");
      return;
    }
    if (!valores.clienteId) {
      setErro("Selecione o cliente.");
      return;
    }
    if (!statusIdEfetivo) {
      setErro("Selecione o status.");
      return;
    }

    const dados: DadosCasoForm = {
      titulo: valores.titulo,
      clienteId: valores.clienteId,
      statusId: statusIdEfetivo,
      responsavelMembroId:
        valores.responsavelMembroId === SEM_RESPONSAVEL_VALOR ? null : valores.responsavelMembroId,
      valor: valores.valor.trim() ? Number(valores.valor) : null,
      descricao: valores.descricao.trim() || null,
    };

    try {
      const { caso } = await criar.mutateAsync(dados);
      toast.success("Caso criado.");
      onSucesso(caso);
    } catch (erroCapturado) {
      const mensagem =
        erroCapturado instanceof ApiError ? erroCapturado.message : "Não foi possível salvar o caso.";
      setErro(mensagem);
      toast.error(mensagem);
    }
  }

  const clientes = opcoes?.clientes ?? [];
  const membros = opcoes?.membros ?? [];
  const status = opcoes?.status ?? [];
  const salvando = criar.isPending;
  // Status default = primeira etapa do funil (menor `ordem`), até o usuário escolher outro.
  const statusIdEfetivo = valores.statusId || (status[0]?.id ?? "");

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="caso-titulo">
          <ICONE_TITULO aria-hidden className="size-3.5 text-muted-foreground" />
          Título
        </Label>
        <Input
          id="caso-titulo"
          name="titulo"
          value={valores.titulo}
          onChange={(evento) => alterar("titulo", evento.target.value)}
          disabled={salvando}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="caso-cliente">
          <ICONE_CLIENTE aria-hidden className="size-3.5 text-muted-foreground" />
          Cliente
        </Label>
        <Select
          value={valores.clienteId || null}
          onValueChange={(valor) => alterar("clienteId", (valor as string) ?? "")}
          disabled={salvando || carregandoOpcoes}
        >
          <SelectTrigger id="caso-cliente" className="w-full">
            <SelectValue>
              {() => clientes.find((c) => c.id === valores.clienteId)?.nome ?? "Selecione"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {clientes.map((cliente) => (
              <SelectItem key={cliente.id} value={cliente.id}>
                {cliente.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="caso-status">Status</Label>
        <Select
          value={statusIdEfetivo || null}
          onValueChange={(valor) => alterar("statusId", (valor as string) ?? "")}
          disabled={salvando || carregandoOpcoes}
        >
          <SelectTrigger id="caso-status" className="w-full">
            <SelectValue>
              {() => status.find((s) => s.id === statusIdEfetivo)?.nome ?? "Selecione"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {status.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: item.cor }} />
                {item.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="caso-responsavel">
          <ICONE_RESPONSAVEL aria-hidden className="size-3.5 text-muted-foreground" />
          Responsável
          <span className="ml-1 text-xs font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Select
          value={valores.responsavelMembroId}
          onValueChange={(valor) => alterar("responsavelMembroId", (valor as string) ?? SEM_RESPONSAVEL_VALOR)}
          disabled={salvando || carregandoOpcoes}
        >
          <SelectTrigger id="caso-responsavel" className="w-full">
            <SelectValue>
              {() =>
                valores.responsavelMembroId === SEM_RESPONSAVEL_VALOR
                  ? "Sem responsável"
                  : (membros.find((m) => m.id === valores.responsavelMembroId)?.nome ?? "Selecione")
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_RESPONSAVEL_VALOR}>Sem responsável</SelectItem>
            {membros.map((membro) => (
              <SelectItem key={membro.id} value={membro.id}>
                {membro.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="caso-valor">
          <ICONE_VALOR aria-hidden className="size-3.5 text-muted-foreground" />
          Valor
          <span className="ml-1 text-xs font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id="caso-valor"
          name="valor"
          type="number"
          min="0"
          step="0.01"
          placeholder="0,00"
          value={valores.valor}
          onChange={(evento) => alterar("valor", evento.target.value)}
          disabled={salvando}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="caso-descricao">
          <ICONE_DESCRICAO aria-hidden className="size-3.5 text-muted-foreground" />
          Descrição
          <span className="ml-1 text-xs font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id="caso-descricao"
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
          <Plus />
          {salvando ? "Salvando..." : "Criar caso"}
        </Button>
      </div>
    </form>
  );
}
