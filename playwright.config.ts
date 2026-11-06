import { defineConfig, devices } from "@playwright/test";
import {
  PORTA_API_E2E,
  PORTA_UAZAPI_FALSA,
  SEGREDO_WEBHOOK_E2E,
  URL_UAZAPI_FALSA,
} from "./e2e/ambiente-e2e";

// Fluxos críticos: docs/testes/estrategia-tdd.md. Roda contra o BUILD DE PRODUÇÃO
// (api em dist/main.mjs + web em vite preview), nunca contra o dev server: é o
// que prova que o bundle do tsup funciona sem tsx e sem decorator metadata.
// `npm run e2e` builda antes; no CI o build é um passo separado.
// A API sobe por `npm run start -w @crm/api`, que carrega a instrumentação do
// New Relic (--import) antes do Nest; nunca com `node dist/main.mjs` direto.
// A UAZAPI é a falsa de e2e/fake-uazapi.mjs (sincronização de campanhas em tempo real);
// E2E_API_PORT troca a porta da API (padrão 3001) quando ela já está ocupada na máquina.
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
      command: "node e2e/fake-uazapi.mjs",
      url: `${URL_UAZAPI_FALSA}/__fake/saude`,
      reuseExistingServer: false,
      env: { E2E_UAZAPI_PORT: String(PORTA_UAZAPI_FALSA) },
      timeout: 10_000,
    },
    {
      command:
        "node -e \"require('fs').accessSync('apps/api/dist/instrumentacao.mjs')\" && npm run start -w @crm/api",
      url: `http://localhost:${PORTA_API_E2E}/api/saude`,
      // Nunca reaproveita: um `npm run dev` ou um dist velho faria o e2e passar contra o código errado.
      reuseExistingServer: false,
      // webServer.env se mescla ao process.env (e vence). NODE_ENV=test garante cookie sem Secure em http.
      // Polling desligado: o progresso só pode chegar pelo webhook, que é o que o e2e prova.
      env: {
        NODE_ENV: "test",
        PORT: String(PORTA_API_E2E),
        UAZAPI_SERVER_URL: URL_UAZAPI_FALSA,
        UAZAPI_WEBHOOK_SECRET: SEGREDO_WEBHOOK_E2E,
        TEMPO_REAL_HABILITADO: "true",
        TEMPO_REAL_POLLING_MS: "0",
        API_PUBLIC_URL: "",
      },
      timeout: 60_000,
    },
    {
      command:
        "node -e \"require('fs').accessSync('apps/web/dist/index.html')\" && npm run preview -w @crm/web -- --port 4173 --strictPort",
      url: "http://localhost:4173",
      reuseExistingServer: false,
      env: { API_NEST_URL: `http://localhost:${PORTA_API_E2E}` },
      timeout: 60_000,
    },
  ],
});
