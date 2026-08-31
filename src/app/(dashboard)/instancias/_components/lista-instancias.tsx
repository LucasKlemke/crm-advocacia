"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import {
  useInstanciasWhatsapp,
  useReconectarInstanciaWhatsapp,
} from "@/hooks/use-instancias-whatsapp";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AvatarIniciais } from "@/components/shared/avatar-iniciais";
import { formatarTelefone } from "@/lib/utils/telefone";
import { StatusBadgeInstancia } from "./status-badge-instancia";
import { NovaInstanciaDialog } from "./nova-instancia-dialog";
import { QrcodeDialog, type QrcodeDialogState } from "./qrcode-dialog";
import type { InstanciaWhatsappDTO } from "@/types/instancia-whatsapp";

export interface ListaInstanciasProps {
  somenteLeitura: boolean;
}

// Só faz sentido reconectar quem não está conectado — connected/hibernated não mostram a ação.
const STATUS_RECONECTAVEIS: ReadonlySet<InstanciaWhatsappDTO["status"]> = new Set([
  "disconnected",
  "connecting",
]);

export function ListaInstancias({ somenteLeitura }: ListaInstanciasProps) {
  const { data, isLoading, isError } = useInstanciasWhatsapp();
  const reconectar = useReconectarInstanciaWhatsapp();

  const [criando, setCriando] = useState(false);
  const [qrcode, setQrcode] = useState<QrcodeDialogState | null>(null);

  const instancias = data?.instancias ?? [];

  async function handleReconectar(instancia: InstanciaWhatsappDTO) {
    try {
      const resposta = await reconectar.mutateAsync(instancia.id);
      setQrcode({
        instanciaId: instancia.id,
        nome: instancia.nome,
        qrcode: resposta.qrcode,
        paircode: resposta.paircode,
      });
    } catch (erro) {
      toast.error(
        erro instanceof ApiError ? erro.message : "Não foi possível reconectar a instância."
      );
    }
  }

  if (isLoading) {
    return <p className="p-4 text-sm text-muted-foreground">Carregando...</p>;
  }

  if (isError) {
    return (
      <p className="p-4 text-sm text-destructive">Não foi possível carregar as instâncias.</p>
    );
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Instâncias de WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            Conecte o WhatsApp do escritório por QR Code e acompanhe o status de cada instância.
          </p>
        </div>
        {!somenteLeitura ? (
          <Button onClick={() => setCriando(true)}>
            <Plus />
            Nova instância
          </Button>
        ) : null}
      </div>

      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="px-4">Instância</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Número conectado</TableHead>
              {!somenteLeitura ? <TableHead className="w-32 px-4" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {instancias.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={somenteLeitura ? 3 : 4}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Nenhuma instância de WhatsApp cadastrada ainda.
                </TableCell>
              </TableRow>
            ) : (
              instancias.map((instancia) => (
                <TableRow key={instancia.id}>
                  <TableCell className="px-4 py-3 font-medium text-foreground">
                    <div className="flex items-center gap-3">
                      <AvatarIniciais nome={instancia.nome} avatarUrl={instancia.fotoPerfilUrl} />
                      {instancia.nome}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadgeInstancia status={instancia.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {instancia.numeroConectado ? formatarTelefone(instancia.numeroConectado) : "–"}
                  </TableCell>
                  {!somenteLeitura ? (
                    <TableCell className="px-4">
                      {STATUS_RECONECTAVEIS.has(instancia.status) ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Reconectar ${instancia.nome}`}
                          disabled={reconectar.isPending}
                          onClick={() => handleReconectar(instancia)}
                        >
                          <RefreshCw />
                          Reconectar
                        </Button>
                      ) : null}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <NovaInstanciaDialog
        open={criando}
        onOpenChange={setCriando}
        onCriada={(resposta, nome) => {
          setCriando(false);
          setQrcode({
            instanciaId: resposta.instancia.id,
            nome,
            qrcode: resposta.qrcode,
            paircode: resposta.paircode,
          });
        }}
      />

      <QrcodeDialog state={qrcode} onOpenChange={(aberto) => !aberto && setQrcode(null)} />
    </>
  );
}
