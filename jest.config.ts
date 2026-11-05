import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

// Metas de cobertura em docs/testes/estrategia-tdd.md: piso institucional 75% backend / 25%
// frontend, com metas internas por camada que garantem esse piso.
const config: Config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // Ponte da Fase 4 (docs/arquitetura/migracao-nestjs.md): o front mora em apps/web, mas
  // as páginas do Next (e seus testes) ainda o importam por "@/". Espelha os paths do
  // tsconfig.json. Sai junto com o Next.
  moduleNameMapper: {
    "^@/compat/(.*)$": "<rootDir>/src/compat-next/$1",
    "^@dominio/(.*)$": "<rootDir>/src/$1",
    "^@/(components|hooks)/(.*)$": "<rootDir>/apps/web/src/$1/$2",
    "^@/lib/(utils|api-client|sessao|site-config|test-utils)$": "<rootDir>/apps/web/src/lib/$1",
    "^@/lib/query/(chaves|opcoes-padrao|query-client-raiz)$": "<rootDir>/apps/web/src/lib/query/$1",
    "^@/lib/utils/(agenda-eventos|agenda-grade|agenda-layout|csv-campanha|data-input|data|nome|oab|role|tipo-arquivo|valor|whatsapp-formatacao)$":
      "<rootDir>/apps/web/src/lib/utils/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testPathIgnorePatterns: ["<rootDir>/e2e/", "<rootDir>/node_modules/", "<rootDir>/.next/", "<rootDir>/apps/"],
  collectCoverageFrom: [
    "src/services/**/*.{ts,tsx}",
    "src/repositories/**/*.{ts,tsx}",
    "src/app/api/**/*.{ts,tsx}",
    // Montagem de payload e query keys compartilhadas entre as rotas HTTP e o prefetch
    // no servidor — lógica de backend, mesmo morando fora de src/app/api.
    "src/lib/api/**/*.{ts,tsx}",
    "src/lib/query/**/*.{ts,tsx}",
    "src/lib/external/**/*.{ts,tsx}",
    "src/lib/auth/**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/*.test.{ts,tsx}",
  ],
  coverageThreshold: {
    global: {},
    "src/services/**/*.{ts,tsx}": {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    "src/repositories/**/*.{ts,tsx}": {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    "src/lib/auth/**/*.{ts,tsx}": {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    "src/app/api/**/*.{ts,tsx}": {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};

export default createJestConfig(config);
