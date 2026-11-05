import {
  ClienteNaoEncontradoError,
  CpfDuplicadoError,
  CpfInvalidoError,
  EmailInvalidoError,
  TelefoneInvalidoError,
} from "@dominio/services/cliente.service";

export function tratarErroDeCliente(error: unknown) {
  if (error instanceof ClienteNaoEncontradoError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  // Formato inválido é 400. Os controllers já barram isso no zod (com erro por campo);
  // este ramo cobre quem chama o Service direto.
  if (
    error instanceof CpfInvalidoError ||
    error instanceof TelefoneInvalidoError ||
    error instanceof EmailInvalidoError
  ) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  // CPF é único por escritório (RN05): colisão é conflito de estado, não erro de forma.
  if (error instanceof CpfDuplicadoError) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  return null;
}
