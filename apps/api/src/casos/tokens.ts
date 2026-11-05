import type { montarListaCasos } from "@dominio/lib/api/payloads/casos-lista";
import type { montarOpcoesFiltroCaso } from "@dominio/lib/api/payloads/casos-filtros";

export const CASO_SERVICE = Symbol("CASO_SERVICE");

// Montadores de payload de payload (lista e opções de filtro) usados pelo controller.
// Entram por token para o teste de
// controller trocá-los sem mockar o casoService que eles usam por dentro.
export const PAYLOADS_CASO = Symbol("PAYLOADS_CASO");

export interface PayloadsCaso {
  montarListaCasos: typeof montarListaCasos;
  montarOpcoesFiltroCaso: typeof montarOpcoesFiltroCaso;
}
