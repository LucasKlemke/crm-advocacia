// Tokens de DI: os services do domínio são objetos singleton (não classes), então
// entram no container via useValue e são injetados por token.
export const STATUS_SERVICE = Symbol("STATUS_SERVICE");
export const TIPO_STATUS_SERVICE = Symbol("TIPO_STATUS_SERVICE");
