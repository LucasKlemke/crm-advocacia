import type { TradutorDeErro } from "../comum/erros-http.filter";
import {
  ConviteJaExisteError,
  ConviteNaoEncontradoError,
  JaEhMembroError,
  PermissaoNegadaError,
} from "@dominio/services/convite.service";

export const tratarErroDeConvite: TradutorDeErro = (error) => {
  if (error instanceof ConviteNaoEncontradoError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof PermissaoNegadaError) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof ConviteJaExisteError || error instanceof JaEhMembroError) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  return null;
};
