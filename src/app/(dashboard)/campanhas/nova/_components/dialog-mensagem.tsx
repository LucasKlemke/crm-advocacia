"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  extrairVariaveis,
  renderizarMensagem,
  sugerirMapeamento,
  type ConfigVariavel,
  type LinhaCsv,
  type MapeamentoVariaveis,
} from "@/lib/utils/campanha-mensagem";
import { ConfigVariavelRow } from "./config-variavel";
import { PreviewWhatsapp } from "./preview-whatsapp";

export interface DialogMensagemProps {
  aberto: boolean;
  mensagem: string;
  mapeamento: MapeamentoVariaveis;
  colunas: string[];
  primeiraLinha: LinhaCsv | undefined;
  // Identidade da instância escolhida na barra de ações: a prévia mostra a conversa como o
  // cliente vai ver, e no topo dela aparece quem está mandando.
  remetenteNome: string;
  remetenteFoto?: string | null;
  onAbertoChange: (aberto: boolean) => void;
  onSalvar: (mensagem: string, mapeamento: MapeamentoVariaveis) => void;
}

export function DialogMensagem({
  aberto,
  mensagem,
  mapeamento,
  colunas,
  primeiraLinha,
  remetenteNome,
  remetenteFoto,
  onAbertoChange,
  onSalvar,
}: DialogMensagemProps) {
  // Rascunho: o que se digita aqui só passa a valer em "Salvar mensagem", então "Cancelar"
  // devolve o texto anterior intacto. O formulário remonta este componente ao abrir/fechar
  // (via `key`), o que reinicializa os dois estados a partir das props sem `useEffect`.
  const [rascunho, setRascunho] = useState(mensagem);
  const [mapa, setMapa] = useState<MapeamentoVariaveis>(mapeamento);

  const variaveis = extrairVariaveis(rascunho);
  const pendentes = variaveis.filter((variavel) => !mapa[variavel]?.coluna);

  // O casamento automático roda a cada digitação, mas só preenche variável ainda sem
  // escolha: uma coluna que o usuário selecionou à mão nunca é sobrescrita pela sugestão.
  function handleTexto(texto: string) {
    setRascunho(texto);
    setMapa((atual) => {
      const sugerido = sugerirMapeamento(extrairVariaveis(texto), colunas);
      return Object.fromEntries(
        Object.entries(sugerido).map(([variavel, config]) => [variavel, atual[variavel] ?? config])
      );
    });
  }

  function handleConfigurar(variavel: string, config: ConfigVariavel | null) {
    setMapa((atual) => ({ ...atual, [variavel]: config }));
  }

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Escrever mensagem</DialogTitle>
          <DialogDescription>
            Use <code className="rounded bg-muted px-1 py-0.5">{"{{variavel}}"}</code> para um dado
            que muda por destinatário. O sistema procura sozinho uma coluna com o mesmo nome na
            planilha.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[65vh] gap-6 overflow-y-auto pr-1 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <Textarea
              // O título do dialog já diz "Escrever mensagem", então um rótulo visível seria
              // redundante — mas o campo continua precisando de nome acessível.
              aria-label="Texto da mensagem"
              autoFocus
              rows={8}
              value={rascunho}
              placeholder="Olá, por acaso estou falando com {{nome}}?"
              onChange={(evento) => handleTexto(evento.target.value)}
            />

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
                        config={mapa[variavel] ?? null}
                        colunas={colunas}
                        primeiraLinha={primeiraLinha}
                        onMudar={handleConfigurar}
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
            {rascunho.trim() ? (
              <>
                <PreviewWhatsapp
                  mensagem={renderizarMensagem(rascunho, primeiraLinha ?? {}, mapa)}
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

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
          <Button
            type="button"
            disabled={rascunho.trim() === ""}
            onClick={() => onSalvar(rascunho, mapa)}
          >
            Salvar mensagem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
