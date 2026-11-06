import type { TradutorDeErro } from "../comum/erros-http.filter";
import { EscritorioNaoEncontradoError, PermissaoNegadaError } from "@dominio/services/escritorio.service";

export const tratarErroDeEscritorio: TradutorDeErro = (error) => {
  if (error instanceof EscritorioNaoEncontradoError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof PermissaoNegadaError) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  return null;
};
