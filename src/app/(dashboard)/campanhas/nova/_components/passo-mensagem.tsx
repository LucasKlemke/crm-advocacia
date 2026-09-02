"use client";

import { Check, TriangleAlert } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { extrairVariaveis, renderizarMensagem, type LinhaCsv } from "@/lib/utils/campanha-mensagem";

export interface PassoMensagemProps {
  mensagem: string;
  colunas: string[];
  primeiraLinha: LinhaCsv | undefined;
  mapeamento: Record<string, string | null>;
  onMensagem: (mensagem: string) => void;
  onMapear: (variavel: string, coluna: string) => void;
}

export function PassoMensagem({
  mensagem,
  colunas,
  primeiraLinha,
  mapeamento,
  onMensagem,
  onMapear,
}: PassoMensagemProps) {
  const variaveis = extrairVariaveis(mensagem);
  const pendentes = variaveis.filter((variavel) => !mapeamento[variavel]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold">Mensagem</h2>
        <p className="text-sm text-muted-foreground">
          Use <code className="rounded bg-muted px-1 py-0.5">{"{{variavel}}"}</code> para inserir
          um dado que muda por destinatário. O sistema procura sozinho uma coluna com o mesmo
          nome na planilha.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="mensagem">Texto da mensagem</Label>
        <Textarea
          id="mensagem"
          rows={5}
          value={mensagem}
          placeholder="Olá, por acaso estou falando com {{nome}}?"
          onChange={(evento) => onMensagem(evento.target.value)}
        />
      </div>

      {variaveis.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Variáveis encontradas</p>
          {variaveis.map((variavel) => {
            const coluna = mapeamento[variavel];
            return (
              <div
                key={variavel}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-2">
                  {coluna ? (
                    <Check className="size-4 text-primary" />
                  ) : (
                    <TriangleAlert className="size-4 text-destructive" />
                  )}
                  <code className="text-sm">{`{{${variavel}}}`}</code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">vem da coluna</span>
                  <Select
                    value={coluna ?? ""}
                    onValueChange={(valor) => onMapear(variavel, valor ?? "")}
                  >
                    <SelectTrigger
                      className="w-56"
                      aria-label={`Coluna para a variável ${variavel}`}
                    >
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
            );
          })}
          {pendentes.length > 0 ? (
            <p role="alert" className="text-sm text-destructive">
              Escolha de qual coluna vem{" "}
              {pendentes.map((variavel) => `{{${variavel}}}`).join(", ")} para continuar.
            </p>
          ) : null}
        </div>
      ) : null}

      {mensagem.trim() && primeiraLinha ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Prévia com a primeira linha da planilha</p>
          <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
            {renderizarMensagem(mensagem, primeiraLinha, mapeamento)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
