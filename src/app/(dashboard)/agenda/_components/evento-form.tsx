"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { paraInputLocal, deInputLocal } from "@/lib/utils/data-input";
import {
  useAtualizarEvento,
  useCriarEvento,
  type DadosEventoPayload,
} from "@/hooks/use-eventos";
import { useCasoFiltroOpcoes } from "@/hooks/use-casos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SeletorVinculo, type VinculoEvento } from "./seletor-vinculo";
import { SeletorParticipantes } from "./seletor-participantes";
import type { EventoDTO, ModalidadeEvento } from "@/types/evento";

export interface EventoFormProps {
  evento?: EventoDTO;
  // Pré-preenchimento vindo do clique num slot vazio da grade.
  inicioSugerido?: Date;
  fimSugerido?: Date;
  onSucesso: (evento: EventoDTO) => void;
  onCancelar?: () => void;
}

interface Valores {
  titulo: string;
  descricao: string;
  inicio: string;
  fim: string;
  diaInteiro: boolean;
  modalidade: ModalidadeEvento;
  local: string;
  linkReuniao: string;
  vinculo: VinculoEvento;
  participanteMembroIds: string[];
}

function vinculoDe(evento?: EventoDTO): VinculoEvento {
  if (evento?.casoId) return { tipo: "caso", id: evento.casoId };
  if (evento?.clienteId) return { tipo: "cliente", id: evento.clienteId };
  return { tipo: "nenhum" };
}

function valoresIniciais(
  evento?: EventoDTO,
  inicioSugerido?: Date,
  fimSugerido?: Date
): Valores {
  const inicio = evento ? new Date(evento.inicio) : (inicioSugerido ?? new Date());
  const fim = evento
    ? new Date(evento.fim)
    : (fimSugerido ?? new Date(inicio.getTime() + 3_600_000));

  return {
    titulo: evento?.titulo ?? "",
    descricao: evento?.descricao ?? "",
    inicio: paraInputLocal(inicio),
    fim: paraInputLocal(fim),
    diaInteiro: evento?.diaInteiro ?? false,
    modalidade: evento?.modalidade ?? "presencial",
    local: evento?.local ?? "",
    linkReuniao: evento?.linkReuniao ?? "",
    vinculo: vinculoDe(evento),
    participanteMembroIds: evento?.participantes.map((p) => p.membroId) ?? [],
  };
}

// Segue o padrão de formulário do projeto: useState + handleSubmit + toast, sem
// react-hook-form (não é dependência do projeto). A validação repetida aqui é só para
// o feedback imediato — a regra de verdade é do EventoService (RN31/RN32/RN35).
export function EventoForm({
  evento,
  inicioSugerido,
  fimSugerido,
  onSucesso,
  onCancelar,
}: EventoFormProps) {
  const criar = useCriarEvento();
  const atualizar = useAtualizarEvento();
  const opcoes = useCasoFiltroOpcoes();
  const [valores, setValores] = useState<Valores>(() =>
    valoresIniciais(evento, inicioSugerido, fimSugerido)
  );
  const [erro, setErro] = useState<string | null>(null);

  const salvando = criar.isPending || atualizar.isPending;

  function alterar<K extends keyof Valores>(campo: K, valor: Valores[K]) {
    setValores((atuais) => ({ ...atuais, [campo]: valor }));
    setErro(null);
  }

  async function handleSubmit(submissao: FormEvent<HTMLFormElement>) {
    submissao.preventDefault();
    setErro(null);

    if (!valores.titulo.trim()) {
      setErro("Informe o título do evento.");
      return;
    }
    if (!valores.inicio || !valores.fim) {
      setErro("Informe o início e o fim do evento.");
      return;
    }

    const inicio = deInputLocal(valores.inicio);
    const fim = deInputLocal(valores.fim);
    // Espelha a RN35: com dia inteiro a faixa é normalizada no servidor, então início e
    // fim iguais (o mesmo dia) são legítimos.
    const periodoValido = valores.diaInteiro
      ? fim.getTime() >= inicio.getTime()
      : fim.getTime() > inicio.getTime();
    if (!periodoValido) {
      setErro("O fim do evento precisa ser depois do início.");
      return;
    }
    if (valores.modalidade === "presencial" && !valores.local.trim()) {
      setErro("Informe o local do evento presencial.");
      return;
    }
    if (valores.modalidade === "online" && !valores.linkReuniao.trim()) {
      setErro("Informe o link da reunião online.");
      return;
    }

    const dados: DadosEventoPayload = {
      titulo: valores.titulo.trim(),
      descricao: valores.descricao.trim() || null,
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      diaInteiro: valores.diaInteiro,
      modalidade: valores.modalidade,
      // O campo da modalidade não escolhida vai como null de propósito (RN32): editar
      // um evento que era presencial não pode deixar o endereço antigo para trás.
      local: valores.modalidade === "presencial" ? valores.local.trim() : null,
      linkReuniao: valores.modalidade === "online" ? valores.linkReuniao.trim() : null,
      casoId: valores.vinculo.tipo === "caso" ? valores.vinculo.id : null,
      clienteId: valores.vinculo.tipo === "cliente" ? valores.vinculo.id : null,
      participanteMembroIds: valores.participanteMembroIds,
    };

    try {
      const resposta = evento
        ? await atualizar.mutateAsync({ id: evento.id, dados })
        : await criar.mutateAsync(dados);
      toast.success(evento ? "Evento atualizado." : "Evento criado.");
      onSucesso(resposta.evento);
    } catch (erroCapturado) {
      const mensagem =
        erroCapturado instanceof ApiError
          ? erroCapturado.message
          : "Não foi possível salvar o evento.";
      setErro(mensagem);
      toast.error(mensagem);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="evento-titulo">Título</Label>
        <Input
          id="evento-titulo"
          name="titulo"
          placeholder="Ex.: Audiência de instrução"
          value={valores.titulo}
          onChange={(campo) => alterar("titulo", campo.target.value)}
          disabled={salvando}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
        <Label htmlFor="evento-dia-inteiro" className="font-normal">
          Dia inteiro
        </Label>
        <Switch
          id="evento-dia-inteiro"
          checked={valores.diaInteiro}
          onCheckedChange={(marcado) => alterar("diaInteiro", marcado === true)}
          disabled={salvando}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="evento-inicio">Início</Label>
          <Input
            id="evento-inicio"
            name="inicio"
            type="datetime-local"
            value={valores.inicio}
            onChange={(campo) => alterar("inicio", campo.target.value)}
            disabled={salvando}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="evento-fim">Fim</Label>
          <Input
            id="evento-fim"
            name="fim"
            type="datetime-local"
            value={valores.fim}
            onChange={(campo) => alterar("fim", campo.target.value)}
            disabled={salvando}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Modalidade</Label>
        <ToggleGroup
          value={[valores.modalidade]}
          onValueChange={(valor) => {
            const escolhida = valor[0] as ModalidadeEvento | undefined;
            if (escolhida) alterar("modalidade", escolhida);
          }}
          disabled={salvando}
          className="w-full"
        >
          <ToggleGroupItem value="presencial" className="flex-1">
            Presencial
          </ToggleGroupItem>
          <ToggleGroupItem value="online" className="flex-1">
            Online
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {valores.modalidade === "presencial" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="evento-local">Local</Label>
          <Input
            id="evento-local"
            name="local"
            placeholder="Ex.: Fórum de Joinville, sala 3"
            value={valores.local}
            onChange={(campo) => alterar("local", campo.target.value)}
            disabled={salvando}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="evento-link">Link da reunião</Label>
          <Input
            id="evento-link"
            name="linkReuniao"
            placeholder="https://meet.google.com/..."
            value={valores.linkReuniao}
            onChange={(campo) => alterar("linkReuniao", campo.target.value)}
            disabled={salvando}
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label>Vínculo</Label>
        <SeletorVinculo
          valor={valores.vinculo}
          onChange={(vinculo) => alterar("vinculo", vinculo)}
          disabled={salvando}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Participantes</Label>
        <SeletorParticipantes
          opcoes={opcoes.data?.membros ?? []}
          selecionados={valores.participanteMembroIds}
          onChange={(ids) => alterar("participanteMembroIds", ids)}
          fixoMembroId={evento?.criadoPorMembroId ?? null}
          disabled={salvando}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="evento-descricao">Notas</Label>
        <Textarea
          id="evento-descricao"
          name="descricao"
          placeholder="Pauta, documentos a levar, observações..."
          value={valores.descricao}
          onChange={(campo) => alterar("descricao", campo.target.value)}
          disabled={salvando}
          rows={4}
        />
      </div>

      {erro ? (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        {onCancelar ? (
          <Button type="button" variant="ghost" onClick={onCancelar} disabled={salvando}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" disabled={salvando}>
          <Save className="size-4" />
          {evento ? "Salvar alterações" : "Criar evento"}
        </Button>
      </div>
    </form>
  );
}
