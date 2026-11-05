import type { TradutorDeErro } from "../comum/erros-http.filter";
import {
  EmailJaCadastradoError,
  SenhaAtualIncorretaError,
  StorageKeyInvalidoError,
  TamanhoAvatarInvalidoError,
} from "@dominio/services/usuario.service";

// Mesmos códigos das rotas Next de /api/perfil/**.
export const tratarErroDePerfil: TradutorDeErro = (error) => {
  if (error instanceof EmailJaCadastradoError) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  if (
    error instanceof SenhaAtualIncorretaError ||
    error instanceof TamanhoAvatarInvalidoError ||
    error instanceof StorageKeyInvalidoError
  ) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  return null;
};
