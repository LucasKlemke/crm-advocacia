import { NextResponse } from "next/server";
import {
  DocumentoNaoEncontradoError,
  DocumentoConflitanteError,
  PermissaoDocumentoError,
  TamanhoInvalidoError,
  TipoInvalidoError,
} from "@/services/documento.service";

export function tratarErroDeDocumento(error: unknown) {
  if (error instanceof DocumentoNaoEncontradoError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof PermissaoDocumentoError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof DocumentoConflitanteError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof TamanhoInvalidoError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof TipoInvalidoError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return null;
}
