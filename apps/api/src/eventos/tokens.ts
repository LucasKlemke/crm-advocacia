import type { serializarEvento, serializarEventos } from "@dominio/lib/api/serializa-evento";

export const EVENTO_SERVICE = Symbol("EVENTO_SERVICE");

// Os serializadores assinam URLs de avatar no S3 (via usuarioService); entrar por
// token permite trocá-los nos testes sem jest.mock de módulo.
export const SERIALIZADOR_EVENTO = Symbol("SERIALIZADOR_EVENTO");

export interface SerializadorEvento {
  serializarEvento: typeof serializarEvento;
  serializarEventos: typeof serializarEventos;
}
