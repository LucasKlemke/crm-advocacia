import type { CampanhaDTO } from "@/types/campanha";

// Pausar só faz sentido em campanha viva; retomar, só em pausada. Concluída e excluindo não
// aceitam nenhuma das duas (a UAZAPI recusaria). Mora num módulo próprio porque a listagem
// e a tela de detalhe oferecem as mesmas ações e não podem divergir no critério.
const PAUSAVEIS: ReadonlySet<CampanhaDTO["status"]> = new Set(["agendada", "enviando"]);

export function podePausar(status: CampanhaDTO["status"]): boolean {
  return PAUSAVEIS.has(status);
}

export function podeRetomar(status: CampanhaDTO["status"]): boolean {
  return status === "pausada";
}
