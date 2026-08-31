"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { useVerificarStatusInstanciaWhatsapp } from "@/hooks/use-instancias-whatsapp";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface QrcodeDialogState {
  instanciaId: string;
  nome: string;
  qrcode?: string;
  paircode?: string;
}

export interface QrcodeDialogProps {
  state: QrcodeDialogState | null;
  onOpenChange: (open: boolean) => void;
}

// "Verificar conexão" é um clique manual — sem polling/websocket (fora do escopo desta
// entrega): o usuário escaneia o QR e decide quando conferir se já conectou.
export function QrcodeDialog({ state, onOpenChange }: QrcodeDialogProps) {
  const verificar = useVerificarStatusInstanciaWhatsapp();
  const [mensagem, setMensagem] = useState<string | null>(null);

  function fechar(aberto: boolean) {
    if (!aberto) setMensagem(null);
    onOpenChange(aberto);
  }

  async function handleVerificar() {
    if (!state) return;
    setMensagem(null);
    try {
      const resposta = await verificar.mutateAsync(state.instanciaId);
      if (resposta.instancia.status === "connected") {
        fechar(false);
      } else {
        setMensagem("Ainda não conectado. Escaneie o QR Code e tente novamente.");
      }
    } catch (erro) {
      toast.error(
        erro instanceof ApiError ? erro.message : "Não foi possível verificar a conexão."
      );
    }
  }

  return (
    <Dialog open={state !== null} onOpenChange={fechar}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conectar {state?.nome}</DialogTitle>
          <DialogDescription>
            Abra o WhatsApp no celular, acesse Aparelhos conectados e escaneie o código abaixo.
          </DialogDescription>
        </DialogHeader>

        {state?.qrcode ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={state.qrcode}
            alt={`QR Code para conectar a instância ${state.nome}`}
            className="mx-auto size-56 rounded-lg border border-border"
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Não foi possível gerar o QR Code desta vez. Tente reconectar novamente.
          </p>
        )}

        {mensagem ? <p className="text-sm text-muted-foreground">{mensagem}</p> : null}

        <DialogFooter>
          <Button type="button" onClick={handleVerificar} disabled={verificar.isPending}>
            <RefreshCw />
            {verificar.isPending ? "Verificando..." : "Verificar conexão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
