// Primeiro import do main.ts: o agente precisa ser carregado antes do Express e do
// @prisma/client para instrumentá-los (transações por rota e tempo de query).
// Sem NEW_RELIC_LICENSE_KEY (dev, CI, testes) o agente nem é importado.
// Configuração toda por env (NEW_RELIC_NO_CONFIG_FILE=true): ver
// docs/qualidade/observabilidade.md.
if (process.env.NEW_RELIC_LICENSE_KEY) {
  await import("newrelic");
}

export {};
