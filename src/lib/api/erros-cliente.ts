import { NextResponse } from "next/server";
import {
  ClienteNaoEncontradoError,
  CpfDuplicadoError,
  CpfInvalidoError,
  EmailInvalidoError,
  TelefoneInvalidoError,
} from "@/services/cliente.service";

export function tratarErroDeCliente(error: unknown) {
  if (error instanceof ClienteNaoEncontradoError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  // Formato inválido é 400. As rotas já barram isso no zod (com erro por campo);
  // este ramo cobre quem chama o Service direto, como um Server Component.
  if (
    error instanceof CpfInvalidoError ||
    error instanceof TelefoneInvalidoError ||
    error instanceof EmailInvalidoError
  ) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  // CPF é único por escritório (RN05): colisão é conflito de estado, não erro de forma.
  if (error instanceof CpfDuplicadoError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  return null;
}
