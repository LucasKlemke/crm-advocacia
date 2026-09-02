import { NextResponse } from "next/server";
import {
  InstanciaWhatsappNaoEncontradaError,
  NomeInstanciaDuplicadoError,
  PermissaoNegadaError,
} from "@/services/instancia-whatsapp.service";
import { UazapiIndisponivelError } from "@/lib/external/uazapi-client";

export function tratarErroDeInstanciaWhatsapp(error: unknown) {
  if (error instanceof InstanciaWhatsappNaoEncontradaError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof PermissaoNegadaError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof NomeInstanciaDuplicadoError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  // Falha de comunicação com a UAZAPI é indisponibilidade de dependência externa, não erro do cliente.
  if (error instanceof UazapiIndisponivelError) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
  return null;
}
