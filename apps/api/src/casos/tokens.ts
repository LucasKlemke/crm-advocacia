import type { montarListaCasos } from "@/lib/api/payloads/casos-lista";
import type { montarOpcoesFiltroCaso } from "@/lib/api/payloads/casos-filtros";

export const CASO_SERVICE = Symbol("CASO_SERVICE");

// Montadores de payload compartilhados com o prefetch dos Server Components do Next:
// a rota e o prefetch precisam produzir o mesmo DTO. Entram por token para o teste de
// controller trocá-los sem mockar o casoService que eles usam por dentro.
export const PAYLOADS_CASO = Symbol("PAYLOADS_CASO");

export interface PayloadsCaso {
  montarListaCasos: typeof montarListaCasos;
  montarOpcoesFiltroCaso: typeof montarOpcoesFiltroCaso;
}
