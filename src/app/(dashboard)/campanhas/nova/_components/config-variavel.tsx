"use client";

import { Check, Plus, TriangleAlert, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TRATAMENTOS_DISPONIVEIS,
  type Tratamento,
} from "@/lib/utils/campanha-tratamentos";
import { resolverValor, type ConfigVariavel, type LinhaCsv } from "@/lib/utils/campanha-mensagem";

export interface ConfigVariavelRowProps {
  variavel: string;
  config: ConfigVariavel | null;
  colunas: string[];
  primeiraLinha: LinhaCsv | undefined;
  onMudar: (variavel: string, config: ConfigVariavel | null) => void;
}

const ROTULO_POR_ID = new Map(TRATAMENTOS_DISPONIVEIS.map((t) => [t.id, t.rotulo]));

export function ConfigVariavelRow({
  variavel,
  config,
  colunas,
  primeiraLinha,
  onMudar,
}: ConfigVariavelRowProps) {
  const tratamentos = config?.tratamentos ?? [];
  // Um tratamento já na cadeia não aparece de novo no menu: aplicá-lo duas vezes seguidas
  // não muda nada e só confunde a leitura da ordem.
  const disponiveis = TRATAMENTOS_DISPONIVEIS.filter((t) => !tratamentos.includes(t.id));

  function mudar(parcial: Partial<ConfigVariavel>) {
    if (!config?.coluna && parcial.coluna === undefined) return;
    onMudar(variavel, { coluna: config?.coluna ?? "", ...config, ...parcial });
  }

  const bruto = primeiraLinha && config?.coluna ? (primeiraLinha[config.coluna] ?? "") : "";
  const resultado = config?.coluna && primeiraLinha ? resolverValor(config, primeiraLinha) : "";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {config?.coluna ? (
            <Check className="size-4 text-primary" />
          ) : (
            <TriangleAlert className="size-4 text-destructive" />
          )}
          <code className="text-sm">{`{{${variavel}}}`}</code>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">vem da coluna</span>
          <Select
            value={config?.coluna ?? ""}
            onValueChange={(valor) => mudar({ coluna: valor ?? "" })}
          >
            <SelectTrigger className="w-56" aria-label={`Coluna para a variável ${variavel}`}>
              <SelectValue placeholder="Escolha a coluna" />
            </SelectTrigger>
            <SelectContent>
              {colunas.map((opcao) => (
                <SelectItem key={opcao} value={opcao}>
                  {opcao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {config?.coluna ? (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Tratamentos {tratamentos.length > 1 ? "(aplicados nesta ordem)" : ""}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {tratamentos.map((tratamento, indice) => (
                <span
                  key={tratamento}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary py-1 pr-1 pl-2 text-xs text-secondary-foreground"
                >
                  <span className="text-muted-foreground">{indice + 1}.</span>
                  {ROTULO_POR_ID.get(tratamento) ?? tratamento}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-5 rounded-full p-0"
                    aria-label={`Remover tratamento ${ROTULO_POR_ID.get(tratamento) ?? tratamento} de ${variavel}`}
                    onClick={() =>
                      mudar({ tratamentos: tratamentos.filter((t) => t !== tratamento) })
                    }
                  >
                    <X className="size-3" />
                  </Button>
                </span>
              ))}

              {disponiveis.length > 0 ? (
                <Select
                  // O Select volta para "" a cada escolha: ele é um menu de ação (adicionar
                  // à cadeia), não um campo com valor selecionado.
                  value=""
                  onValueChange={(valor) =>
                    valor && mudar({ tratamentos: [...tratamentos, valor as Tratamento] })
                  }
                >
                  <SelectTrigger
                    className="h-7 w-auto gap-1 border-dashed px-2 text-xs"
                    aria-label={`Adicionar tratamento em ${variavel}`}
                  >
                    <Plus className="size-3" />
                    <span>Adicionar tratamento</span>
                  </SelectTrigger>
                  <SelectContent>
                    {disponiveis.map((tratamento) => (
                      <SelectItem key={tratamento.id} value={tratamento.id}>
                        <span className="flex flex-col items-start">
                          <span>{tratamento.rotulo}</span>
                          <span className="text-xs text-muted-foreground">
                            {tratamento.exemploEntrada} → {tratamento.exemplo}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor={`padrao-${variavel}`} className="text-xs font-medium text-muted-foreground">
              Se a célula estiver vazia, usar
            </Label>
            <Input
              id={`padrao-${variavel}`}
              className="h-7 w-56 text-xs"
              maxLength={120}
              placeholder="(deixa em branco)"
              value={config.padrao ?? ""}
              onChange={(evento) => mudar({ padrao: evento.target.value })}
            />
          </div>

          {primeiraLinha ? (
            <p className="text-xs text-muted-foreground">
              Primeira linha:{" "}
              {/* O "antes" só aparece quando algum tratamento (ou o padrão) mudou o valor —
                  repetir o mesmo texto dos dois lados da seta seria ruído. */}
              {bruto !== resultado ? (
                <>
                  <span className="line-through">{bruto || "(vazio)"}</span>{" "}
                  <span aria-hidden>→</span>{" "}
                </>
              ) : null}
              <span className="font-medium text-foreground">{resultado || "(vazio)"}</span>
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
