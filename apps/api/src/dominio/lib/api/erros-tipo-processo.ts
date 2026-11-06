import {
  TipoProcessoNaoEncontradoError,
  NomeTipoProcessoDuplicadoError,
  TipoProcessoComCasosError,
  PermissaoNegadaError,
} from "@dominio/services/tipo-processo.service";

export function tratarErroDeTipoProcesso(error: unknown) {
  if (error instanceof TipoProcessoNaoEncontradoError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof PermissaoNegadaError) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  // Nome duplicado e tipo com processos vinculados são conflitos de estado, não erro de forma.
  if (
    error instanceof NomeTipoProcessoDuplicadoError ||
    error instanceof TipoProcessoComCasosError
  ) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  return null;
}
