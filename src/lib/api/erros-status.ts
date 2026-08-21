import { NextResponse } from "next/server";
import {
  StatusNaoEncontradoError,
  NomeStatusDuplicadoError,
  TipoStatusInvalidoError,
  StatusComCasosError,
  PermissaoNegadaError,
} from "@/services/status.service";

export function tratarErroDeStatus(error: unknown) {
  if (error instanceof StatusNaoEncontradoError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof PermissaoNegadaError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  // Formato inválido é 400. As rotas já barram isso no zod (com erro por campo);
  // este ramo cobre quem chama o Service direto, como um Server Component.
  if (error instanceof TipoStatusInvalidoError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  // Nome duplicado e status com casos vinculados são conflitos de estado, não erro de forma.
  if (error instanceof NomeStatusDuplicadoError || error instanceof StatusComCasosError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  return null;
}
