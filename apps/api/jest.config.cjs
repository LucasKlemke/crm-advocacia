// CJS de propósito: o pacote é "type": "module", e o Jest 29 roda em CommonJS.
// O @swc/jest transpila o código da API, o domínio (src/dominio), o pacote
// @crm/compartilhado e os pacotes ESM (Nest 12, jose e o archiver com suas deps ESM) para CJS.
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  setupFiles: ["<rootDir>/jest.setup.ts"],
  transform: {
    "^.+\\.(t|j|mj)s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
        },
        module: { type: "commonjs" },
      },
    ],
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(@nestjs|jose|archiver|zip-stream|compress-commons|crc32-stream|is-stream)/)",
  ],
  moduleNameMapper: {
    "^@dominio/(.*)$": "<rootDir>/src/dominio/$1",
    "^@crm/compartilhado/(.*)$": "<rootDir>/../../packages/compartilhado/src/$1",
  },
  moduleFileExtensions: ["ts", "js", "mjs", "json"],

  // Piso institucional: 75% no grupo backend (docs/testes/estrategia-tdd.md),
  // conferido por scripts/verificar-piso-cobertura.mjs somando api + compartilhado.
  // As metas abaixo são as internas, por camada.
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.test.ts",
    "!src/**/*.d.ts",
    // Bootstrap do processo (listen, dotenv, agente APM): exercitado pelo e2e
    // contra o build de produção, não por teste unitário.
    "!src/main.ts",
    "!src/instrumentacao.ts",
    // Declaração de módulos Nest (só metadata de wiring), sem lógica.
    "!src/**/*.module.ts",
    "!src/**/tokens.ts",
    "!src/dominio/lib/prisma.ts",
  ],
  coverageReporters: ["text-summary", "lcov", "json-summary"],
  coverageThreshold: {
    global: { branches: 70, functions: 75, lines: 75, statements: 75 },
    "./src/dominio/services/": { branches: 90, functions: 90, lines: 90, statements: 90 },
    "./src/dominio/repositories/": { branches: 70, functions: 70, lines: 70, statements: 70 },
    "./src/dominio/lib/auth/": { branches: 90, functions: 90, lines: 90, statements: 90 },
    "./src/**/*.controller.ts": { branches: 70, functions: 70, lines: 70, statements: 70 },
    "./src/comum/": { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};
