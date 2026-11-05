import type { TradutorDeErro } from "../comum/erros-http.filter";
import {
  MembroNaoEncontradoError,
  PermissaoNegadaError,
  UltimoOwnerError,
} from "@/services/membro.service";

export const tratarErroDeMembro: TradutorDeErro = (error) => {
  if (error instanceof MembroNaoEncontradoError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof PermissaoNegadaError) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof UltimoOwnerError) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  return null;
};
