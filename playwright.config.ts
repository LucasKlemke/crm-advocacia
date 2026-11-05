import { defineConfig, devices } from "@playwright/test";

// Fluxos críticos: docs/testes/estrategia-tdd.md. Roda contra o BUILD DE PRODUÇÃO
// (api em dist/main.js + web em vite preview), nunca contra o dev server: é o
// que prova que o bundle do tsup funciona sem tsx e sem decorator metadata.
// `npm run e2e` builda antes; no CI o build é um passo separado.
// A API sobe por `npm run start -w @crm/api`, que carrega a instrumentação do
// New Relic (--import) antes do Nest; nunca com `node dist/main.js` direto.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "html",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command:
        "node -e \"require('fs').accessSync('apps/api/dist/instrumentacao.js')\" && npm run start -w @crm/api",
      url: "http://localhost:3001/api/saude",
      // Nunca reaproveita: um `npm run dev` ou um dist velho faria o e2e passar contra o código errado.
      reuseExistingServer: false,
      // webServer.env se mescla ao process.env (e vence). NODE_ENV=test garante cookie sem Secure em http.
      env: { NODE_ENV: "test" },
      timeout: 60_000,
    },
    {
      command:
        "node -e \"require('fs').accessSync('apps/web/dist/index.html')\" && npm run preview -w @crm/web -- --port 4173 --strictPort",
      url: "http://localhost:4173",
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
