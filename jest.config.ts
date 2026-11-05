import type { Config } from "jest";

// Jest da raiz: só o domínio (services, repositories, lib de backend). O front tem suíte
// própria em apps/web (npm run web:test) e a API em apps/api (npm run api:test).
// Metas de cobertura em docs/testes/estrategia-tdd.md.
const config: Config = {
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transform: {
    "^.+\\.(t|j|mj)sx?$": [
      "@swc/jest",
      {
        jsc: { parser: { syntax: "typescript", tsx: true }, transform: { react: { runtime: "automatic" } } },
        module: { type: "commonjs" },
      },
    ],
  },
  // Pacotes só-ESM usados pelo domínio (jose e archiver, com suas deps) passam pelo SWC.
  transformIgnorePatterns: ["/node_modules/(?!(jose|archiver|zip-stream|compress-commons|crc32-stream|is-stream)/)"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testPathIgnorePatterns: ["<rootDir>/e2e/", "<rootDir>/node_modules/", "<rootDir>/apps/"],
  collectCoverageFrom: [
    "src/services/**/*.{ts,tsx}",
    "src/repositories/**/*.{ts,tsx}",
    "src/lib/api/**/*.{ts,tsx}",
    "src/lib/external/**/*.{ts,tsx}",
    "src/lib/auth/**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/*.test.{ts,tsx}",
  ],
  coverageThreshold: {
    global: {},
    "src/services/**/*.{ts,tsx}": { branches: 90, functions: 90, lines: 90, statements: 90 },
    "src/repositories/**/*.{ts,tsx}": { branches: 70, functions: 70, lines: 70, statements: 70 },
    "src/lib/auth/**/*.{ts,tsx}": { branches: 90, functions: 90, lines: 90, statements: 90 },
  },
};

export default config;
