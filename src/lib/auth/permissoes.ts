import type { RoleMembro } from "@prisma/client";

// Hierarquia de papéis dentro de um escritório (RN02a): owner > admin > padrao.
// Módulo puro — sem I/O — para ser exaustivamente testável.
export const NIVEL_ROLE: Record<RoleMembro, number> = {
  owner: 3,
  admin: 2,
  padrao: 1,
};

// Um ator só altera/remove um alvo de nível estritamente menor que o seu — exceto
// owner, que também pode gerenciar outro owner (a proteção do último owner é feita à
// parte por violaUltimoOwner).
export function podeGerenciarMembro(atorRole: RoleMembro, alvoRole: RoleMembro): boolean {
  if (atorRole === "owner") {
    return true;
  }
  return NIVEL_ROLE[atorRole] > NIVEL_ROLE[alvoRole];
}

// Só um owner pode promover outro membro a owner; admin/owner podem atribuir os demais papéis.
export function podeAtribuirRole(atorRole: RoleMembro, novoRole: RoleMembro): boolean {
  if (novoRole === "owner") {
    return atorRole === "owner";
  }
  return atorRole === "owner" || atorRole === "admin";
}

// Nunca rebaixar/remover o último owner de um escritório.
export function violaUltimoOwner(alvoRoleAtual: RoleMembro, totalOwners: number): boolean {
  return alvoRoleAtual === "owner" && totalOwners <= 1;
}

// Auto-remoção/auto-alteração de role bloqueada no v1.
export function ehAutoAlvo(atorUsuarioId: string, alvoUsuarioId: string): boolean {
  return atorUsuarioId === alvoUsuarioId;
}

// Comentário é conteúdo autoral: só o autor edita o próprio texto.
export function podeEditarComentario(ehAutor: boolean): boolean {
  return ehAutor;
}

// Excluir é moderação: o autor pode remover o que escreveu, e owner/admin podem
// remover comentário de qualquer membro do escritório.
export function podeModerarComentario(atorRole: RoleMembro, ehAutor: boolean): boolean {
  return ehAutor || atorRole === "owner" || atorRole === "admin";
}

// Excluir ou renomear documento é a mesma regra de moderação de comentário (RN21): o
// autor do upload altera o que enviou, e owner/admin alteram documento de qualquer membro.
export function podeModerarDocumento(atorRole: RoleMembro, ehAutor: boolean): boolean {
  return ehAutor || atorRole === "owner" || atorRole === "admin";
}
