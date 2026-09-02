"use client";

import { MessageSquare, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  extrairVariaveis,
  renderizarMensagem,
  type ConfigVariavel,
  type LinhaCsv,
  type MapeamentoVariaveis,
} from "@/lib/utils/campanha-mensagem";
import { TRATAMENTOS_DISPONIVEIS } from "@/lib/utils/campanha-tratamentos";
import { PreviewWhatsapp } from "./preview-whatsapp";

const ROTULO_TRATAMENTO = new Map(TRATAMENTOS_DISPONIVEIS.map((t) => [t.id, t.rotulo]));

export interface SecaoMensagemProps {
  mensagem: string;
  mapeamento: MapeamentoVariaveis;
  primeiraLinha: LinhaCsv | undefined;
  // Identidade da instância escolhida na barra de ações: a prévia mostra a conversa como o
  // cliente vai ver, e no topo dela aparece quem está mandando.
  remetenteNome: string;
  remetenteFoto?: string | null;
  onEditar: () => void;
}

// Resumo em texto do que o dialog configurou — quem está lendo a página não vê os selects,
// então a coluna, os tratamentos e o valor padrão precisam aparecer escritos.
function descreverConfig(config: ConfigVariavel | null | undefined): string {
  if (!config?.coluna) return "";
  const tratamentos = (config.tratamentos ?? [])
    .map((tratamento) => ROTULO_TRATAMENTO.get(tratamento) ?? tratamento)
    .join(" → ");
  const padrao = config.padrao ? ` · vazio vira "${config.padrao}"` : "";
  return `coluna "${config.coluna}"${tratamentos ? ` · ${tratamentos}` : ""}${padrao}`;
}

// A edição da mensagem mora no dialog: aqui fora fica só a prévia do que o cliente recebe.
export function SecaoMensagem({
  mensagem,
  mapeamento,
  primeiraLinha,
  remetenteNome,
  remetenteFoto,
  onEditar,
}: SecaoMensagemProps) {
  const variaveis = extrairVariaveis(mensagem);
  const escrita = mensagem.trim() !== "";

  return (
    // `aria-label` transforma a <section> em landmark, do mesmo jeito que a de contatos:
    // com dois botões "Editar mensagem" na tela (barra e seção), é o que dá endereço a cada um.
    <section aria-label="Mensagem" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <MessageSquare className="size-4 text-primary" />
          Mensagem
        </h2>
        {escrita ? (
          <Button type="button" variant="outline" size="sm" onClick={onEditar}>
            <Pencil />
            Editar mensagem
          </Button>
        ) : null}
      </div>

      {escrita ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              {primeiraLinha
                ? "Prévia — como o primeiro contato da planilha vai receber"
                : "Prévia da mensagem"}
            </p>
            <PreviewWhatsapp
              mensagem={renderizarMensagem(mensagem, primeiraLinha ?? {}, mapeamento)}
              remetenteNome={remetenteNome || "Sua instância"}
              remetenteFoto={remetenteFoto}
            />
          </div>

          {variaveis.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Variáveis</p>
              <ul className="flex flex-col gap-1.5 text-sm">
                {variaveis.map((variavel) => {
                  const descricao = descreverConfig(mapeamento[variavel]);
                  return (
                    <li key={variavel} className="flex flex-wrap items-baseline gap-1.5">
                      <code className="rounded bg-muted px-1 py-0.5 text-xs">{`{{${variavel}}}`}</code>
                      {descricao ? (
                        <span className="text-muted-foreground">{descricao}</span>
                      ) : (
                        <span role="alert" className="text-destructive">
                          sem coluna escolhida — abra “Editar mensagem”
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma mensagem escrita. É ela que vai para todos os contatos da planilha.
          </p>
          {/* Rótulo diferente do botão da barra de ações de propósito: dois alvos com o
              mesmo nome acessível na mesma tela confundem quem navega por leitor de tela. */}
          <Button type="button" variant="outline" onClick={onEditar}>
            <MessageSquare />
            Escrever agora
          </Button>
        </div>
      )}
    </section>
  );
}
