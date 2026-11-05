import {
  CasoNaoEncontradoError,
  ClienteInativoError,
  ResponsavelInvalidoError,
} from "@dominio/services/caso.service";
import { ClienteNaoEncontradoError } from "@dominio/services/cliente.service";
import { StatusNaoEncontradoError } from "@dominio/services/status.service";

// Uma rota de caso reusa clienteService.obter/statusService.obter para validar as FKs
// (RN06/RN07) — os erros deles precisam ser mapeados aqui também, não só os de Caso.
export function tratarErroDeCaso(error: unknown) {
  if (
    error instanceof CasoNaoEncontradoError ||
    error instanceof ClienteNaoEncontradoError ||
    error instanceof StatusNaoEncontradoError
  ) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ClienteInativoError || error instanceof ResponsavelInvalidoError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  return null;
}
