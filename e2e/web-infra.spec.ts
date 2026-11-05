import { test, expect } from "@playwright/test";

// Infra do front (Fase 4). Vale para os dois alvos do E2E: a proteção de rota (RN01) é
// a mesma regra do proxy.ts do Next, agora também implementada pela RotaProtegida.
test("rota protegida sem sessão leva ao login guardando o destino", async ({ page }) => {
  await page.goto("/clientes?pagina=2");

  await expect(page).toHaveURL("/login?callbackUrl=%2Fclientes%3Fpagina%3D2");
});

test("o front alcança a API pela mesma origem", async ({ request }) => {
  test.skip(process.env.E2E_ALVO !== "web", "O proxy /api → :3001 é o do Vite; o Next tem rewrites próprios.");

  const resposta = await request.get("/api/saude");

  expect(resposta.status()).toBe(200);
  expect(await resposta.json()).toEqual({ ok: true });
});
