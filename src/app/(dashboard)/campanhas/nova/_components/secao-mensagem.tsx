"use client";

import { MessageSquare } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  extrairVariaveis,
  renderizarMensagem,
  type ConfigVariavel,
  type LinhaCsv,
  type MapeamentoVariaveis,
} from "@/lib/utils/campanha-mensagem";
import { ConfigVariavelRow } from "./config-variavel";
import { PreviewWhatsapp } from "./preview-whatsapp";

export interface SecaoMensagemProps {
  mensagem: string;
  colunas: string[];
  primeiraLinha: LinhaCsv | undefined;
  mapeamento: MapeamentoVariaveis;
  // Identidade da instância escolhida na barra de ações: a prévia mostra a conversa como
  // o cliente vai ver, e no topo dela aparece quem está mandando.
  remetenteNome: string;
  remetenteFoto?: string | null;
  onMensagem: (mensagem: string) => void;
  onConfigurar: (variavel: string, config: ConfigVariavel | null) => void;
}

export const ID_CAMPO_MENSAGEM = "mensagem";

export function SecaoMensagem({
  mensagem,
  colunas,
  primeiraLinha,
  mapeamento,
  remetenteNome,
  remetenteFoto,
  onMensagem,
  onConfigurar,
}: SecaoMensagemProps) {
  const variaveis = extrairVariaveis(mensagem);
  const pendentes = variaveis.filter((variavel) => !mapeamento[variavel]?.coluna);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <MessageSquare className="size-4 text-primary" />
        Mensagem
      </h2>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Textarea
              id={ID_CAMPO_MENSAGEM}
              // O título da seção já diz "Mensagem", então um rótulo visível seria
              // redundante — mas o campo continua precisando de nome acessível.
              aria-label="Texto da mensagem"
              rows={6}
              value={mensagem}
              placeholder="Olá, por acaso estou falando com {{nome}}?"
              onChange={(evento) => onMensagem(evento.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Use <code className="rounded bg-muted px-1 py-0.5">{"{{variavel}}"}</code> para um
              dado que muda por destinatário. O sistema procura sozinho uma coluna com o mesmo
              nome na planilha.
            </p>
          </div>

          {variaveis.length > 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium">Variáveis encontradas</p>
              {colunas.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Faça o upload da planilha de contatos para escolher de qual coluna vem cada
                  variável.
                </p>
              ) : (
                <>
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
                      {pendentes.map((variavel) => `{{${variavel}}}`).join(", ")}.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            {primeiraLinha
              ? "Prévia — como o primeiro contato da planilha vai receber"
              : "Prévia da mensagem"}
          </p>
          {mensagem.trim() ? (
            <>
              <PreviewWhatsapp
                mensagem={renderizarMensagem(mensagem, primeiraLinha ?? {}, mapeamento)}
                remetenteNome={remetenteNome || "Sua instância"}
                remetenteFoto={remetenteFoto}
              />
              <p className="text-xs text-muted-foreground">
                O WhatsApp interpreta *negrito*, _itálico_, ~riscado~ e ```mono``` — a prévia
                mostra o resultado final.
              </p>
            </>
          ) : (
            <div className="flex min-h-52 items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Escreva a mensagem para ver como ela vai chegar no WhatsApp do cliente.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
