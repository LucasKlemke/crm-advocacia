"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  extrairVariaveis,
  renderizarMensagem,
  type ConfigVariavel,
  type LinhaCsv,
  type MapeamentoVariaveis,
} from "@/lib/utils/campanha-mensagem";
import { ConfigVariavelRow } from "./config-variavel";

export interface PassoMensagemProps {
  mensagem: string;
  colunas: string[];
  primeiraLinha: LinhaCsv | undefined;
  mapeamento: MapeamentoVariaveis;
  onMensagem: (mensagem: string) => void;
  onConfigurar: (variavel: string, config: ConfigVariavel | null) => void;
}

export function PassoMensagem({
  mensagem,
  colunas,
  primeiraLinha,
  mapeamento,
  onMensagem,
  onConfigurar,
}: PassoMensagemProps) {
  const variaveis = extrairVariaveis(mensagem);
  const pendentes = variaveis.filter((variavel) => !mapeamento[variavel]?.coluna);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold">Mensagem</h2>
        <p className="text-sm text-muted-foreground">
          Use <code className="rounded bg-muted px-1 py-0.5">{"{{variavel}}"}</code> para inserir
          um dado que muda por destinatário. O sistema procura sozinho uma coluna com o mesmo
          nome na planilha, e você pode tratar o valor antes de ele entrar na mensagem.
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
          {variaveis.map((variavel) => (
            <ConfigVariavelRow
              key={variavel}
              variavel={variavel}
              config={mapeamento[variavel] ?? null}
              colunas={colunas}
              primeiraLinha={primeiraLinha}
              onMudar={onConfigurar}
            />
          ))}
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
