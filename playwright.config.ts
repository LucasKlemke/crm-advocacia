import { defineConfig, devices } from "@playwright/test";

// Fluxos críticos cobertos aqui: docs/testes/estrategia-tdd.md
// Sobe a API Nest (:3001) e o front React/Vite (build + preview em :5173), que encaminha
// /api para a API pelo proxy do Vite.
const reaproveitar = !process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: { baseURL: "http://localhost:5173", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run api:dev",
      url: "http://localhost:3001/api/saude",
      reuseExistingServer: reaproveitar,
      timeout: 120_000,
    },
    {
      command: "npm run web:build && npm run web:preview",
      url: "http://localhost:5173",
      reuseExistingServer: reaproveitar,
      timeout: 180_000,
    },
  ],
});
