// CJS de propósito: o pacote é "type": "module" e o Jest 29 roda em CommonJS.
// @swc/jest substitui o jest do Next da raiz — mesmas transformações (TS + JSX automático).
// Metas de cobertura: docs/testes/estrategia-tdd.md (piso institucional de 25% no front).
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
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@crm/compartilhado/(.*)$": "<rootDir>/../../packages/compartilhado/src/$1",
  },
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.test.{ts,tsx}",
    "!src/main.tsx",
    "!src/lib/test-utils*.tsx",
    // Primitivas geradas pelo shadcn CLI (docs/app/design-system.md) — cobertas pelos
    // componentes que as compõem.
    "!src/components/ui/**",
  ],
  coverageThreshold: {
    global: { branches: 25, functions: 25, lines: 25, statements: 25 },
  },
};
