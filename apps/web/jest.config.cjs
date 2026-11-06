// CJS de propósito: o pacote é "type": "module" e o Jest 29 roda em CommonJS.
// @swc/jest substitui o jest do Next da raiz — mesmas transformações (TS + JSX automático).
// Metas de cobertura: docs/testes/estrategia-tdd.md (piso institucional de 25% no front).
// Fuso fixo: as datas são exibidas no horário local do navegador (escritórios no Brasil) e
// os testes comparam strings formatadas. Sem isto, o runner do CI (UTC) desloca 3 h.
process.env.TZ = "America/Sao_Paulo";

module.exports = {
  testEnvironment: "<rootDir>/test/ambiente-jsdom.cjs",
  roots: ["<rootDir>/src"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transform: {
    "^.+\\.(t|j)sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", tsx: true },
          transform: { react: { runtime: "automatic" } },
        },
        module: { type: "commonjs" },
      },
    ],
  },
  moduleNameMapper: {
    // `import.meta.env` não compila em CommonJS: o leitor de env do Vite vira um stub.
    "^@/lib/env-ws$": "<rootDir>/test/env-ws.ts",
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@crm/compartilhado/(.*)$": "<rootDir>/../../packages/compartilhado/src/$1",
  },
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.test.{ts,tsx}",
    "!src/main.tsx",
    "!src/lib/test-utils*.tsx",
    "!src/lib/env-ws.ts",
    "!src/vite-env.d.ts",
    // Primitivas geradas pelo shadcn CLI (docs/app/design-system.md) — cobertas pelos
    // componentes que as compõem.
    "!src/components/ui/**",
  ],
  coverageReporters: ["text-summary", ["lcov", { projectRoot: "../.." }], "json-summary"],
  coverageThreshold: {
    global: { branches: 25, functions: 25, lines: 25, statements: 25 },
  },
};
