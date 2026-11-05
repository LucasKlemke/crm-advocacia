import { test, expect } from "@playwright/test";

// Infra do front (Fase 4). A proteção de rota (RN01) é implementada pela RotaProtegida.
test("rota protegida sem sessão leva ao login guardando o destino", async ({ page }) => {
  await page.goto("/clientes?pagina=2");

  await expect(page).toHaveURL("/login?callbackUrl=%2Fclientes%3Fpagina%3D2");
});

test("o front alcança a API pela mesma origem", async ({ request }) => {
  const resposta = await request.get("/api/saude");

  expect(resposta.status()).toBe(200);
  expect(await resposta.json()).toEqual({ ok: true });
});
