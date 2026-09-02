"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Briefcase,
  CalendarClock,
  ExternalLink,
  MapPin,
  Pencil,
  Trash2,
  User,
  Video,
} from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { formatarDataHoraCurta, formatarIntervaloEvento } from "@/lib/utils/data";
import { useExcluirEvento } from "@/hooks/use-eventos";
import { AvatarIniciais } from "@/components/shared/avatar-iniciais";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EventoForm } from "./evento-form";
import type { EventoDTO } from "@/types/evento";

export type ModoEventoSheet = "criar" | "ver" | "editar";

export interface EventoSheetProps {
  modo: ModoEventoSheet;
  evento: EventoDTO | null;
  inicioSugerido?: Date;
  fimSugerido?: Date;
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
}

// Uma única drawer para os três modos (criar/ver/editar), como CasoSheet: o evento
// recém-criado já volta hidratado do POST, então a transição para "ver" não precisa de
// uma segunda requisição.
export function EventoSheet({
  modo,
  evento,
  inicioSugerido,
  fimSugerido,
  aberto,
  onOpenChange,
}: EventoSheetProps) {
  const excluir = useExcluirEvento();
  const [editando, setEditando] = useState(modo === "editar");
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [salvo, setSalvo] = useState<EventoDTO | null>(null);

  const exibido = salvo?.id === evento?.id ? salvo : evento;
  const criando = modo === "criar";

  function fechar(abertoAgora: boolean) {
    if (!abertoAgora) {
      setEditando(false);
      setSalvo(null);
    }
    onOpenChange(abertoAgora);
  }

  async function confirmarExclusao() {
    if (!exibido) return;
    try {
      await excluir.mutateAsync(exibido.id);
      toast.success("Evento excluído.");
      setConfirmandoExclusao(false);
      fechar(false);
    } catch (erro) {
      toast.error(
        erro instanceof ApiError ? erro.message : "Não foi possível excluir o evento."
      );
    }
  }

  return (
    <>
      <Sheet open={aberto} onOpenChange={fechar}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {criando ? "Novo evento" : editando ? "Editar evento" : (exibido?.titulo ?? "Evento")}
            </SheetTitle>
            <SheetDescription>
              {criando
                ? "Marque um compromisso na agenda do escritório."
                : exibido
                  ? formatarIntervaloEvento(exibido.inicio, exibido.fim, exibido.diaInteiro)
                  : null}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {criando || editando ? (
              <EventoForm
                evento={editando && exibido ? exibido : undefined}
                inicioSugerido={inicioSugerido}
                fimSugerido={fimSugerido}
                onSucesso={(atualizado) => {
                  setSalvo(atualizado);
                  if (criando) {
                    fechar(false);
                    return;
                  }
                  setEditando(false);
                }}
                onCancelar={() => (criando ? fechar(false) : setEditando(false))}
              />
            ) : exibido ? (
              <EventoDetalhe evento={exibido} />
            ) : null}
          </div>

          {!criando && !editando && exibido ? (
            <SheetFooter className="flex-row justify-between border-t border-border">
              {/* RN34: quem não é autor nem gestor vê o evento, mas sem as ações. */}
              {exibido.podeEditar ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmandoExclusao(true)}
                  >
                    <Trash2 className="size-4" />
                    Excluir
                  </Button>
                  <Button type="button" onClick={() => setEditando(true)}>
                    <Pencil className="size-4" />
                    Editar
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Só quem criou o evento, ou um administrador, pode alterá-lo.
                </p>
              )}
            </SheetFooter>
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmandoExclusao} onOpenChange={setConfirmandoExclusao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este evento?</AlertDialogTitle>
            <AlertDialogDescription>
              O evento sai da agenda de todos os participantes. O registro fica no histórico
              do escritório.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao} disabled={excluir.isPending}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function EventoDetalhe({ evento }: { evento: EventoDTO }) {
  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex flex-col gap-2 text-sm">
        <span className="flex items-center gap-2">
          <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
          {formatarIntervaloEvento(evento.inicio, evento.fim, evento.diaInteiro)}
        </span>

        {evento.modalidade === "presencial" ? (
          <span className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0 text-muted-foreground" />
            {evento.local}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Video className="size-4 shrink-0 text-muted-foreground" />
            <a
              href={evento.linkReuniao ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 truncate underline underline-offset-4"
            >
              Entrar na reunião
              <ExternalLink className="size-3.5" />
            </a>
          </span>
        )}
      </div>

      {evento.caso || evento.cliente ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Vínculo</h3>
          {evento.caso ? (
            <span className="flex items-center gap-2 text-sm">
              <Briefcase className="size-4 shrink-0 text-muted-foreground" />
              {evento.caso.tipoProcesso.nome} — {evento.caso.cliente.nome}
              {evento.caso.numeroProcesso ? (
                <Badge variant="outline">{evento.caso.numeroProcesso}</Badge>
              ) : null}
            </span>
          ) : null}
          {evento.cliente ? (
            <span className="flex items-center gap-2 text-sm">
              <User className="size-4 shrink-0 text-muted-foreground" />
              {evento.cliente.nome}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Participantes</h3>
        <ul className="flex flex-col gap-2">
          {evento.participantes.map((participante) => (
            <li key={participante.membroId} className="flex items-center gap-2 text-sm">
              <AvatarIniciais
                nome={participante.usuario.nome}
                avatarUrl={participante.usuario.avatarUrl}
                className="size-7"
              />
              <span className="truncate">{participante.usuario.nome}</span>
              {participante.membroId === evento.criadoPorMembroId ? (
                <Badge variant="secondary">Organizador</Badge>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {evento.descricao ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Notas</h3>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{evento.descricao}</p>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Criado por {evento.criadoPor.usuario.nome} em {formatarDataHoraCurta(evento.createdAt)}
      </p>
    </div>
  );
}
