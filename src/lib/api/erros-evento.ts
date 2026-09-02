import { NextResponse } from "next/server";
import {
  EventoNaoEncontradoError,
  MembroDaSessaoInvalidoError,
  ModalidadeEventoInvalidaError,
  ParticipanteInvalidoError,
  PermissaoNegadaError,
  VinculoEventoExclusivoError,
} from "@/services/evento.service";
import { CasoNaoEncontradoError } from "@/services/caso.service";
import { ClienteNaoEncontradoError } from "@/services/cliente.service";
import { PeriodoEventoInvalidoError } from "@/lib/utils/evento-periodo";

export function tratarErroDeEvento(error: unknown) {
  if (error instanceof EventoNaoEncontradoError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  // FA-13: o evento aponta para um processo/cliente que não é deste tenant (ou não
  // existe): 404 pelo mesmo motivo — não confirmar a existência de dado alheio.
  if (error instanceof CasoNaoEncontradoError || error instanceof ClienteNaoEncontradoError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  // FA-16: não é autor nem gestor do escritório.
  if (error instanceof PermissaoNegadaError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  // Vínculo perdido entre a emissão do contexto e a escrita: a sessão precisa ser refeita.
  if (error instanceof MembroDaSessaoInvalidoError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  // FA-14/FA-15 e RN32/RN33: o corpo é sintaticamente válido (passou pelo zod), mas o
  // conteúdo viola uma regra de negócio — 422, não 400.
  if (
    error instanceof PeriodoEventoInvalidoError ||
    error instanceof VinculoEventoExclusivoError ||
    error instanceof ModalidadeEventoInvalidaError ||
    error instanceof ParticipanteInvalidoError
  ) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  return null;
}
