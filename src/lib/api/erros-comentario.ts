import { NextResponse } from "next/server";
import {
  ComentarioNaoEncontradoError,
  ConteudoVazioError,
  PermissaoComentarioError,
} from "@/services/comentario.service";

export function tratarErroDeComentario(error: unknown) {
  if (error instanceof ComentarioNaoEncontradoError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof PermissaoComentarioError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof ConteudoVazioError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return null;
}
