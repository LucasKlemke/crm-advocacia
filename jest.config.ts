import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

// Metas de cobertura em docs/testes/estrategia-tdd.md: piso institucional 75% backend / 25%
// frontend, com metas internas por camada que garantem esse piso.
const config: Config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testPathIgnorePatterns: ["<rootDir>/e2e/", "<rootDir>/node_modules/", "<rootDir>/.next/"],
  collectCoverageFrom: [
    "src/services/**/*.{ts,tsx}",
    "src/repositories/**/*.{ts,tsx}",
    "src/app/api/**/*.{ts,tsx}",
    "src/lib/external/**/*.{ts,tsx}",
    "src/components/**/*.{ts,tsx}",
    "src/hooks/**/*.{ts,tsx}",
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
    "src/app/api/**/*.{ts,tsx}": {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    "src/components/**/*.{ts,tsx}": {
      branches: 25,
      functions: 25,
      lines: 25,
      statements: 25,
    },
    "src/hooks/**/*.{ts,tsx}": {
      branches: 25,
      functions: 25,
      lines: 25,
      statements: 25,
    },
  },
};

export default createJestConfig(config);
