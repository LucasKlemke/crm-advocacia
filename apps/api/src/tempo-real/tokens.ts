// AgendadorSincronizacao entra no container por token (useFactory), como os services do domínio.
export const AGENDADOR_SINCRONIZACAO = Symbol("AGENDADOR_SINCRONIZACAO");
// ConfigTempoReal lida uma vez do ambiente (lerConfigTempoReal); token para os testes trocarem.
export const CONFIG_TEMPO_REAL = Symbol("CONFIG_TEMPO_REAL");
