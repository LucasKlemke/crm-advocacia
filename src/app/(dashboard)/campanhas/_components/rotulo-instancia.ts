import type { CampanhaDTO } from "@/types/campanha";

// Como a campanha identifica a conexão que a disparou. Mora num módulo próprio porque a
// listagem e a tela de detalhe mostram a mesma informação e não podem divergir.
//
// São três estados, e confundi-los esconde do usuário por que a campanha parou de responder:
// - null: campanha anterior ao soft delete, cuja instância foi apagada de verdade. Sem
//   token, ela é histórico somente-leitura — não dá para sincronizar nem controlar.
// - excluída: o vínculo sobreviveu, então a campanha continua controlável enquanto a UAZAPI
//   aceitar o token; exibir só o nome faria parecer que a conexão ainda está de pé.
// - ativa: o nome, sem adorno.
export function rotuloInstancia(instancia: CampanhaDTO["instancia"]): string {
  if (!instancia) return "Instância removida";
  return instancia.softDeletedAt ? `${instancia.nome} (excluída)` : instancia.nome;
}
