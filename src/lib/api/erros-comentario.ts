import {
  ComentarioNaoEncontradoError,
  ConteudoVazioError,
  PermissaoComentarioError,
} from "@/services/comentario.service";

export function tratarErroDeComentario(error: unknown) {
  if (error instanceof ComentarioNaoEncontradoError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof PermissaoComentarioError) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof ConteudoVazioError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  return null;
}
