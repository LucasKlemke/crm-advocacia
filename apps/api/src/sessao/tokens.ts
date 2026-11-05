// Tokens de DI do SessaoModule. Os objetos do domínio são singletons (não classes), por
// isso entram por useValue — o mesmo padrão da Fase 1.
export const AUTORIZAR_CREDENCIAIS = Symbol("AUTORIZAR_CREDENCIAIS");
export const USUARIO_SERVICE = Symbol("SESSAO_USUARIO_SERVICE");
export const MEMBRO_REPOSITORY = Symbol("SESSAO_MEMBRO_REPOSITORY");
export const MEMBRO_SERVICE = Symbol("SESSAO_MEMBRO_SERVICE");
export const ESCRITORIO_SERVICE = Symbol("SESSAO_ESCRITORIO_SERVICE");
