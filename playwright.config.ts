import { defineConfig, devices } from "@playwright/test";

// Fluxos críticos cobertos aqui: docs/testes/estrategia-tdd.md
//
// Fase 4 da migração (docs/arquitetura/migracao-nestjs.md): o mesmo conjunto de specs
// roda contra dois fronts. "next" (E2E_ALVO=next) sobe a API Nest e o
// Next em :3000; "web" (padrão) sobe a API Nest e o front React/Vite em :5173
// (build + preview), que encaminha /api para a API pelo proxy do Vite. A parte 4b
// apaga o ramo "next" junto com o Next.
const alvo = process.env.E2E_ALVO === "next" ? "next" : "web";
const reaproveitar = !process.env.CI;

const api = {
  command: "npm run api:dev",
  url: "http://localhost:3001/api/saude",
  reuseExistingServer: reaproveitar,
  timeout: 120_000,
};

const servidores =
  alvo === "web"
    ? [
        api,
        {
          command: "npm run web:build && npm run web:preview",
          url: "http://localhost:5173",
          reuseExistingServer: reaproveitar,
          timeout: 180_000,
        },
      ]
    : [
        api,
        {
          command: "npm run build && npm run start",
          url: "http://localhost:3000",
          reuseExistingServer: reaproveitar,
          timeout: 300_000,
          env: { API_NEST_URL: "http://localhost:3001" },
        },
      ];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: alvo === "web" ? "http://localhost:5173" : "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: servidores,
});
