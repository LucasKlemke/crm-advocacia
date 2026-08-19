"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { useAtualizarCaso, useCasoFiltroOpcoes, type DadosCasoForm } from "@/hooks/use-casos";
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

export interface CasoDadosProps {
  caso: CasoDTO;
  onAtualizado?: (caso: CasoDTO) => void;
}

interface Valores {
  titulo: string;
  clienteId: string;
  statusId: string;
  responsavelMembroId: string;
  valor: string;
  descricao: string;
}

function valoresIniciais(caso: CasoDTO): Valores {
  return {
    titulo: caso.titulo,
    clienteId: caso.clienteId,
    statusId: caso.statusId,
    responsavelMembroId: caso.responsavelMembroId ?? SEM_RESPONSAVEL_VALOR,
    valor: caso.valor === null ? "" : String(caso.valor),
    descricao: caso.descricao ?? "",
  };
}

// Selects (cliente/status/responsável) salvam ao trocar; título/valor/descrição têm
// texto livre e só salvam com o botão explícito, como em ClienteDados — mas montado
// como formulário completo (não campo-a-campo) porque a maioria dos campos é select.
export function CasoDados({ caso, onAtualizado }: CasoDadosProps) {
  const { data: opcoes } = useCasoFiltroOpcoes();
  const atualizar = useAtualizarCaso();
  const [valores, setValores] = useState<Valores>(() => valoresIniciais(caso));
  const [original, setOriginal] = useState<Valores>(() => valoresIniciais(caso));
  const [erro, setErro] = useState<string | null>(null);

  const clientes = opcoes?.clientes ?? [];
  const membros = opcoes?.membros ?? [];
  const status = opcoes?.status ?? [];
  const alteradoTexto =
    valores.titulo !== original.titulo ||
    valores.valor !== original.valor ||
    valores.descricao !== original.descricao;

  function alterar<K extends keyof Valores>(campo: K, valor: Valores[K]) {
    setValores((atuais) => ({ ...atuais, [campo]: valor }));
    setErro(null);
  }

  async function salvarCampo(dados: Partial<DadosCasoForm>, novosValores: Valores) {
    try {
      const { caso: atualizado } = await atualizar.mutateAsync({ id: caso.id, dados });
      setValores(novosValores);
      setOriginal(novosValores);
      onAtualizado?.(atualizado);
      toast.success("Caso atualizado.");
    } catch (erroCapturado) {
      const mensagem =
        erroCapturado instanceof ApiError ? erroCapturado.message : "Não foi possível salvar o caso.";
      setErro(mensagem);
      toast.error(mensagem);
    }
  }

  async function alterarStatus(statusId: string) {
    const novos = { ...valores, statusId };
    setValores(novos);
    await salvarCampo({ statusId }, novos);
  }

  async function alterarCliente(clienteId: string) {
    const novos = { ...valores, clienteId };
    setValores(novos);
    await salvarCampo({ clienteId }, novos);
  }

  async function alterarResponsavel(valor: string) {
    const novos = { ...valores, responsavelMembroId: valor };
    setValores(novos);
    await salvarCampo(
      { responsavelMembroId: valor === SEM_RESPONSAVEL_VALOR ? null : valor },
      novos
    );
  }

  async function salvarTexto() {
    if (!valores.titulo.trim()) {
      setErro("Informe o título do caso.");
      return;
    }
    setErro(null);
    const dados: Partial<DadosCasoForm> = {};
    if (valores.titulo !== original.titulo) dados.titulo = valores.titulo;
    if (valores.valor !== original.valor) dados.valor = valores.valor.trim() ? Number(valores.valor) : null;
    if (valores.descricao !== original.descricao) dados.descricao = valores.descricao || null;
    await salvarCampo(dados, valores);
  }

  function cancelarTexto() {
    setValores((atuais) => ({ ...atuais, ...original }));
    setErro(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="caso-dados-titulo">
          <ICONE_TITULO aria-hidden className="size-3.5 text-muted-foreground" />
          Título
        </Label>
        <Input
          id="caso-dados-titulo"
          value={valores.titulo}
          onChange={(evento) => alterar("titulo", evento.target.value)}
          disabled={atualizar.isPending}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="caso-dados-cliente">
          <ICONE_CLIENTE aria-hidden className="size-3.5 text-muted-foreground" />
          Cliente
        </Label>
        <Select
          value={valores.clienteId || null}
          onValueChange={(valor) => alterarCliente(valor as string)}
          disabled={atualizar.isPending}
        >
          <SelectTrigger id="caso-dados-cliente" className="w-full">
            <SelectValue>
              {() => clientes.find((c) => c.id === valores.clienteId)?.nome ?? caso.cliente.nome}
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
        <Label htmlFor="caso-dados-status">Status</Label>
        <Select
          value={valores.statusId || null}
          onValueChange={(valor) => alterarStatus(valor as string)}
          disabled={atualizar.isPending}
        >
          <SelectTrigger id="caso-dados-status" className="w-full">
            <SelectValue>
              {() => status.find((s) => s.id === valores.statusId)?.nome ?? caso.status.nome}
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
        <Label htmlFor="caso-dados-responsavel">
          <ICONE_RESPONSAVEL aria-hidden className="size-3.5 text-muted-foreground" />
          Responsável
        </Label>
        <Select
          value={valores.responsavelMembroId}
          onValueChange={(valor) => alterarResponsavel(valor as string)}
          disabled={atualizar.isPending}
        >
          <SelectTrigger id="caso-dados-responsavel" className="w-full">
            <SelectValue>
              {() =>
                valores.responsavelMembroId === SEM_RESPONSAVEL_VALOR
                  ? "Sem responsável"
                  : (membros.find((m) => m.id === valores.responsavelMembroId)?.nome ??
                    caso.responsavel?.usuario.nome ??
                    "Sem responsável")
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
        <Label htmlFor="caso-dados-valor">
          <ICONE_VALOR aria-hidden className="size-3.5 text-muted-foreground" />
          Valor
        </Label>
        <Input
          id="caso-dados-valor"
          type="number"
          min="0"
          step="0.01"
          value={valores.valor}
          onChange={(evento) => alterar("valor", evento.target.value)}
          disabled={atualizar.isPending}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="caso-dados-descricao">
          <ICONE_DESCRICAO aria-hidden className="size-3.5 text-muted-foreground" />
          Descrição
        </Label>
        <Textarea
          id="caso-dados-descricao"
          value={valores.descricao}
          onChange={(evento) => alterar("descricao", evento.target.value)}
          disabled={atualizar.isPending}
        />
      </div>

      {erro ? (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      ) : null}

      {alteradoTexto ? (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={cancelarTexto} disabled={atualizar.isPending}>
            Cancelar
          </Button>
          <Button size="sm" onClick={salvarTexto} disabled={atualizar.isPending}>
            <Save />
            {atualizar.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
