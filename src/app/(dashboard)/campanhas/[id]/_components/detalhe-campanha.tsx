"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Pause, Play } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { useCampanha, useControlarCampanha, useMensagensCampanha } from "@/hooks/use-campanhas";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatarTelefone } from "@/lib/utils/telefone";
import { normalizarMapeamento } from "@/lib/utils/campanha-mensagem";
import { TRATAMENTOS_DISPONIVEIS } from "@/lib/utils/campanha-tratamentos";
import {
  chaveTelefone,
  resumirPorNumero,
  type ResumoMensagem,
} from "@/lib/utils/campanha-status-mensagem";
import { podePausar, podeRetomar } from "../../_components/controle-campanha";
import { StatusBadgeCampanha } from "../../_components/status-badge-campanha";
import { StatusBadgeMensagem } from "./status-badge-mensagem";

export interface DetalheCampanhaProps {
  campanhaId: string;
  somenteLeitura: boolean;
}

const ROTULO_TRATAMENTO = new Map(TRATAMENTOS_DISPONIVEIS.map((t) => [t.id, t.rotulo]));

// Uma célula da coluna Status: o que a UAZAPI sabe sobre a mensagem daquele destinatário.
// Número sem mensagem correspondente fica em "—" — é bem diferente de dizer "pendente".
function CelulaStatus({
  resumo,
  carregando,
}: {
  resumo: ResumoMensagem | undefined;
  carregando: boolean;
}) {
  if (!resumo) {
    return carregando ? (
      <Loader2 aria-label="Buscando status" className="size-3.5 animate-spin text-muted-foreground" />
    ) : (
      <span className="text-muted-foreground" title="A UAZAPI não devolveu mensagem para este número">
        —
      </span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-0.5">
      <StatusBadgeMensagem status={resumo.status} />
      {resumo.erro ? <span className="text-xs text-destructive">{resumo.erro}</span> : null}
      {resumo.quantidade > 1 ? (
        <span className="text-xs text-muted-foreground">
          {resumo.quantidade} mensagens para este número
        </span>
      ) : null}
    </div>
  );
}

function Metrica({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="text-lg font-semibold">{valor}</p>
    </div>
  );
}

export function DetalheCampanha({ campanhaId, somenteLeitura }: DetalheCampanhaProps) {
  const [pagina, setPagina] = useState(1);
  const { data, isLoading, isError } = useCampanha(campanhaId, pagina);
  const controlar = useControlarCampanha();
  // Só depois que o banco respondeu: a tabela de destinatários é o que dá contexto ao
  // status, e uma campanha que nem carregou não tem por que consultar a UAZAPI.
  const mensagens = useMensagensCampanha(campanhaId, data !== undefined);

  // Mesmas ações da listagem, aqui na tela onde o andamento é acompanhado. O status vem do
  // refetch que a mutation dispara — nada de estado local espelhando a campanha.
  async function handleControlar(acao: "stop" | "continue") {
    try {
      await controlar.mutateAsync({ id: campanhaId, acao });
      toast.success(acao === "stop" ? "Campanha pausada." : "Campanha retomada.");
    } catch (erro) {
      toast.error(erro instanceof ApiError ? erro.message : "Não foi possível alterar a campanha.");
    }
  }

  if (isLoading) {
    return <p className="p-4 text-sm text-muted-foreground">Carregando...</p>;
  }

  if (isError || !data) {
    return <p className="p-4 text-sm text-destructive">Não foi possível carregar a campanha.</p>;
  }

  const { campanha, itens, total, porPagina } = data;
  const statusPorNumero = resumirPorNumero(mensagens.data?.mensagens ?? []);
  const ultimaPagina = Math.max(1, Math.ceil(total / porPagina));
  // O Json vem cru do banco e pode estar no formato anterior aos tratamentos.
  const mapeamento = Object.entries(normalizarMapeamento(campanha.mapeamentoVariaveis));

  return (
    <>
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="self-start" render={<Link href="/campanhas" />}>
          <ArrowLeft />
          Campanhas
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{campanha.nome}</h1>
            <p className="text-sm text-muted-foreground">
              {campanha.instancia?.nome ?? "Instância removida"} · {campanha.totalDestinatarios}{" "}
              destinatário(s) · intervalo de {campanha.delayMin}s a {campanha.delayMax}s
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadgeCampanha status={campanha.status} />
            {!somenteLeitura && podePausar(campanha.status) ? (
              <Button
                variant="outline"
                size="sm"
                disabled={controlar.isPending}
                onClick={() => handleControlar("stop")}
              >
                {controlar.isPending ? <Loader2 className="animate-spin" /> : <Pause />}
                Pausar
              </Button>
            ) : null}
            {!somenteLeitura && podeRetomar(campanha.status) ? (
              <Button
                variant="outline"
                size="sm"
                disabled={controlar.isPending}
                onClick={() => handleControlar("continue")}
              >
                {controlar.isPending ? <Loader2 className="animate-spin" /> : <Play />}
                Retomar
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Metrica rotulo="Na fila" valor={campanha.logTotal} />
        <Metrica rotulo="Enviadas" valor={campanha.logSucesso} />
        <Metrica rotulo="Entregues" valor={campanha.logEntregue} />
        <Metrica rotulo="Lidas" valor={campanha.logLido} />
        <Metrica rotulo="Falhas" valor={campanha.logFalha} />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Mensagem-modelo</h2>
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
          {campanha.mensagemTemplate}
        </p>
        {mapeamento.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Variáveis:{" "}
            {mapeamento
              .map(([variavel, config]) => {
                const tratamentos = (config?.tratamentos ?? [])
                  .map((t) => ROTULO_TRATAMENTO.get(t) ?? t)
                  .join(" → ");
                const padrao = config?.padrao ? `, vazio vira "${config.padrao}"` : "";
                return `{{${variavel}}} → coluna "${config?.coluna}"${
                  tratamentos ? ` (${tratamentos})` : ""
                }${padrao}`;
              })
              .join(" · ")}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Destinatários</h2>
          {mensagens.isFetching ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Consultando o status de cada mensagem na UAZAPI...
            </span>
          ) : null}
          {mensagens.isError ? (
            <span className="text-xs text-muted-foreground">
              Não foi possível consultar o status das mensagens na UAZAPI.
            </span>
          ) : null}
        </div>
        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-16 px-4">Linha</TableHead>
                <TableHead className="w-48">Número</TableHead>
                <TableHead className="w-40">Status</TableHead>
                <TableHead className="px-4">Mensagem enviada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="px-4 py-2 text-sm text-muted-foreground">
                    {item.linha}
                  </TableCell>
                  <TableCell className="py-2 text-sm">{formatarTelefone(item.numero)}</TableCell>
                  <TableCell className="py-2 text-sm">
                    <CelulaStatus
                      // chaveTelefone dos dois lados: o jid do WhatsApp vem sem o nono
                      // dígito que o número gravado tem.
                      resumo={statusPorNumero.get(chaveTelefone(item.numero))}
                      carregando={mensagens.isLoading}
                    />
                  </TableCell>
                  <TableCell className="px-4 py-2 text-sm whitespace-pre-wrap">
                    {item.mensagem}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {ultimaPagina > 1 ? (
          <div className="flex items-center justify-end gap-2">
            <span className="text-sm text-muted-foreground">
              Página {pagina} de {ultimaPagina}
            </span>
            <Button
              variant="outline"
              size="sm"
              aria-label="Página anterior"
              disabled={pagina === 1}
              onClick={() => setPagina((atual) => atual - 1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-label="Próxima página"
              disabled={pagina >= ultimaPagina}
              onClick={() => setPagina((atual) => atual + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}
