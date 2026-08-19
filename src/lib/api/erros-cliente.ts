import { NextResponse } from "next/server";
import {
  ClienteNaoEncontradoError,
  CpfDuplicadoError,
  CpfInvalidoError,
} from "@/services/cliente.service";

export function tratarErroDeCliente(error: unknown) {
  if (error instanceof ClienteNaoEncontradoError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof CpfInvalidoError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  // CPF é único por escritório (RN05): colisão é conflito de estado, não erro de forma.
  if (error instanceof CpfDuplicadoError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  return null;
}
