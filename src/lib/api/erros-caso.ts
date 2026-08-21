import { NextResponse } from "next/server";
import {
  CasoNaoEncontradoError,
  ClienteInativoError,
  ResponsavelInvalidoError,
} from "@/services/caso.service";
import { ClienteNaoEncontradoError } from "@/services/cliente.service";
import { StatusNaoEncontradoError } from "@/services/status.service";

// Uma rota de caso reusa clienteService.obter/statusService.obter para validar as FKs
// (RN06/RN07) — os erros deles precisam ser mapeados aqui também, não só os de Caso.
export function tratarErroDeCaso(error: unknown) {
  if (
    error instanceof CasoNaoEncontradoError ||
    error instanceof ClienteNaoEncontradoError ||
    error instanceof StatusNaoEncontradoError
  ) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ClienteInativoError || error instanceof ResponsavelInvalidoError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return null;
}
