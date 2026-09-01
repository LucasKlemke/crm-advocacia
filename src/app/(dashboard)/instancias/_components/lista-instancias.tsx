"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw, Wifi } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import {
  useInstanciasWhatsapp,
  useReconectarInstanciaWhatsapp,
  useSincronizarInstanciasWhatsapp,
  useVerificarStatusInstanciaWhatsapp,
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
  const verificarStatus = useVerificarStatusInstanciaWhatsapp();
  const sincronizar = useSincronizarInstanciasWhatsapp();

  const [criando, setCriando] = useState(false);
  const [qrcode, setQrcode] = useState<QrcodeDialogState | null>(null);

  const instancias = data?.instancias ?? [];

  // As mutations de Reconectar/Verificar status são compartilhadas por todas as linhas
  // da tabela — sem isolar por `variables`, clicar numa linha desabilitaria o botão de
  // todas as outras enquanto a chamada dessa linha estivesse pendente.
  const reconectandoId = reconectar.isPending ? reconectar.variables : undefined;
  const verificandoId = verificarStatus.isPending ? verificarStatus.variables : undefined;

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

  async function handleVerificarStatus(instancia: InstanciaWhatsappDTO) {
    try {
      await verificarStatus.mutateAsync(instancia.id);
      toast.success("Status verificado.");
    } catch (erro) {
      toast.error(
        erro instanceof ApiError ? erro.message : "Não foi possível verificar o status da instância."
      );
    }
  }

  async function handleSincronizar() {
    try {
      await sincronizar.mutateAsync();
      toast.success("Instâncias sincronizadas.");
    } catch {
      // Erro genérico de propósito: nunca expõe corpo/detalhe da resposta ao usuário.
      toast.error("Não foi possível sincronizar as instâncias.");
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
        <div className="flex items-center gap-2">
          {instancias.length > 0 ? (
            <Button
              variant="outline"
              disabled={sincronizar.isPending}
              onClick={handleSincronizar}
            >
              <RefreshCw className={sincronizar.isPending ? "animate-spin" : undefined} />
              Sincronizar
            </Button>
          ) : null}
          {!somenteLeitura ? (
            <Button onClick={() => setCriando(true)}>
              <Plus />
              Nova instância
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="px-4">Instância</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Número conectado</TableHead>
              {!somenteLeitura ? <TableHead className="w-56 px-4" /> : null}
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
                    <TableCell className="flex items-center gap-1 px-4">
                      {STATUS_RECONECTAVEIS.has(instancia.status) ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Reconectar ${instancia.nome}`}
                          disabled={reconectandoId === instancia.id}
                          onClick={() => handleReconectar(instancia)}
                        >
                          <RefreshCw />
                          Reconectar
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Verificar status ${instancia.nome}`}
                        disabled={verificandoId === instancia.id}
                        onClick={() => handleVerificarStatus(instancia)}
                      >
                        <Wifi className={verificandoId === instancia.id ? "animate-pulse" : undefined} />
                        Verificar status
                      </Button>
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
