"use client";

import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { useCriarInstanciaWhatsapp } from "@/hooks/use-instancias-whatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RespostaConexaoInstanciaWhatsapp } from "@/types/instancia-whatsapp";

const NOME_MAX = 60;

export interface NovaInstanciaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Devolve a resposta crua (instancia + qrcode/paircode) e o nome digitado, para quem
  // orquestra (lista-instancias.tsx) abrir o dialog de QR code em seguida.
  onCriada: (resposta: RespostaConexaoInstanciaWhatsapp, nome: string) => void;
}

// Validação client-side espelhando novaInstanciaWhatsappSchema (nome obrigatório, até 60
// caracteres) — mesmo estilo manual do TipoProcessoForm/StatusForm, sem importar o zod
// schema do server no bundle do client.
export function NovaInstanciaDialog({ open, onOpenChange, onCriada }: NovaInstanciaDialogProps) {
  const criar = useCriarInstanciaWhatsapp();
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function fechar(aberto: boolean) {
    if (!aberto) {
      setNome("");
      setErro(null);
    }
    onOpenChange(aberto);
  }

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    const nomeTratado = nome.trim();
    if (!nomeTratado) {
      setErro("Informe o nome da instância.");
      return;
    }
    if (nomeTratado.length > NOME_MAX) {
      setErro(`Nome deve ter no máximo ${NOME_MAX} caracteres.`);
      return;
    }

    try {
      const resposta = await criar.mutateAsync({ nome: nomeTratado });
      onCriada(resposta, nomeTratado);
      setNome("");
    } catch (erroCapturado) {
      const mensagem =
        erroCapturado instanceof ApiError
          ? erroCapturado.message
          : "Não foi possível criar a instância de WhatsApp.";
      setErro(mensagem);
    }
  }

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Nova instância</DialogTitle>
            <DialogDescription>
              Crie uma instância para conectar um número de WhatsApp ao escritório.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="nova-instancia-nome">Nome</Label>
            <Input
              id="nova-instancia-nome"
              name="nome"
              placeholder="Ex.: Atendimento principal"
              value={nome}
              onChange={(evento) => {
                setNome(evento.target.value);
                setErro(null);
              }}
              disabled={criar.isPending}
              autoFocus
            />
          </div>

          {erro ? (
            <p role="alert" className="text-sm text-destructive">
              {erro}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => fechar(false)}
              disabled={criar.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={criar.isPending}>
              <Plus />
              {criar.isPending ? "Criando..." : "Criar instância"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
