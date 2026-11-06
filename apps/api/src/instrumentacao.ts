// Carregado ANTES de tudo, via `node --import ./dist/instrumentacao.mjs` (start) ou
// `tsx --import ./src/instrumentacao.ts` (dev). Não pode ser importado pelo main.ts:
// no bundle ESM os imports externos (Nest, Prisma, Express) são avaliados antes do
// corpo do módulo, e o agente do New Relic precisa vir antes deles para instrumentá-los.
// Lê o .env local primeiro para que NEW_RELIC_LICENSE_KEY de apps/api/.env.local valha.
// Sem a chave (dev, CI, testes) o agente nem é importado. Configuração por env
// (NEW_RELIC_NO_CONFIG_FILE=true): ver docs/qualidade/observabilidade.md.
import { resolve } from "node:path";
import { carregarEnvLocal } from "./config/carregar-env";

carregarEnvLocal(resolve(import.meta.dirname, ".."));

if (process.env.NEW_RELIC_LICENSE_KEY) {
  await import("newrelic");
}
