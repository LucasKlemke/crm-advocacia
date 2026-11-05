import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import jest from "eslint-plugin-jest";
import jsxA11y from "eslint-plugin-jsx-a11y";
import playwright from "eslint-plugin-playwright";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

// Sem eslint-config-next: o front é Vite (apps/web) e a API é Nest (apps/api).
export default defineConfig([
  globalIgnores([
    "**/dist/**",
    "**/coverage/**",
    "**/node_modules/**",
    "playwright-report/**",
    "test-results/**",
    "apps/api/prisma/migrations/**",
    // Gerados pelo shadcn CLI, nunca editados à mão (docs/app/design-system.md).
    "apps/web/src/components/ui/**",
  ]),

  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },

  // API + compartilhado + scripts: Node.
  {
    files: ["apps/api/**/*.{ts,mjs,cjs}", "packages/**/*.{ts,cjs}", "scripts/**/*.mjs", "*.{ts,mjs}", "e2e/**/*.ts"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: { sourceType: "commonjs", globals: { ...globals.node } },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },

  // Fronteiras entre pacotes (docs/app/estrutura-codigo.md — "Regra de fronteira").
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@prisma/client", "@prisma/*"], message: "O web não acessa o banco: use DTOs/enums de @crm/compartilhado." },
            { group: ["@dominio/*", "**/apps/api/**"], message: "O web fala com a API só por HTTP (lib/api-client)." },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/compartilhado/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@prisma/*", "@nestjs/*", "react", "react-*"], message: "O compartilhado é puro: sem Prisma, Nest ou React." },
            { group: ["@dominio/*", "@/*", "**/apps/**"], message: "O compartilhado não depende de nenhum app." },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/api/src/**/*.controller.ts"],
    rules: {
      "no-restricted-imports": "off",
      "@typescript-eslint/no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@dominio/repositories/*"], message: "Controller nunca chama Repository: passe pelo Service.", allowTypeImports: true }] },
      ],
    },
  },

  // Web: React, hooks e acessibilidade (RNF de acessibilidade em CLAUDE.md).
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    ...jsxA11y.flatConfigs.recommended,
    languageOptions: {
      ...jsxA11y.flatConfigs.recommended.languageOptions,
      globals: { ...globals.browser },
    },
    plugins: {
      ...jsxA11y.flatConfigs.recommended.plugins,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      "jsx-a11y/label-has-associated-control": ["error", { controlComponents: ["Checkbox"] }],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },

  // Testes: nenhum .only/.skip esquecido passa no CI (docs/testes/estrategia-tdd.md).
  {
    files: ["**/*.test.{ts,tsx}"],
    ...jest.configs["flat/recommended"],
    languageOptions: { globals: { ...globals.jest } },
    rules: {
      ...jest.configs["flat/recommended"].rules,
      "jest/no-focused-tests": "error",
      "jest/no-disabled-tests": "error",
      // supertest: `request(app).get(...).expect(200)` também é asserção.
      "jest/expect-expect": ["warn", { assertFunctionNames: ["expect", "request.**.expect", "**.expect"] }],
    },
  },
  {
    files: ["e2e/**/*.ts"],
    ...playwright.configs["flat/recommended"],
    rules: {
      ...playwright.configs["flat/recommended"].rules,
      "playwright/no-focused-test": "error",
      "playwright/no-skipped-test": "error",
    },
  },
]);
